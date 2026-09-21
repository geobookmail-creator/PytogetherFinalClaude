from decimal import Decimal

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expenses.views import get_accessible_tour
from apps.tours.models import TourMember

from .models import Notification, Settlement
from .serializers import (
    CreateSettlementSerializer,
    NotificationSerializer,
    SettlementSerializer,
)
from .services import compute_settlement_suggestions, compute_tour_balances

try:
    import stripe
    stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
except ImportError:  # pragma: no cover - stripe is an optional dependency
    stripe = None


def is_tour_member(tour, user):
    return tour.created_by_id == user.id or TourMember.objects.filter(
        tour=tour, user=user
    ).exists()


def notify(recipient, actor, notif_type, message, tour=None, settlement=None):
    return Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notif_type=notif_type,
        message=message,
        tour=tour,
        settlement=settlement,
    )


def _pending_lookup(tour):
    """Map (payer_id, payee_id) -> latest still-open Settlement, for a tour."""

    lookup = {}

    settlements = Settlement.objects.filter(
        tour=tour,
        status__in=[Settlement.STATUS_PENDING],
    ).select_related("payer", "payee").order_by("created_at")

    for settlement in settlements:
        lookup[(settlement.payer_id, settlement.payee_id)] = settlement

    return lookup


class TourBalancesAPIView(APIView):
    """
    The settle-up view for a tour: each member's net balance, plus the
    smallest set of payments that would clear everyone, annotated with
    any settlement request already in flight for that pair.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tour_id):

        tour = get_accessible_tour(request, tour_id)

        _, share_per_member, balances, total_expense = compute_tour_balances(tour)
        suggestions = compute_settlement_suggestions(tour)
        pending = _pending_lookup(tour)

        members = []
        for entry in sorted(
            balances.values(), key=lambda item: item["user"].full_name.lower()
        ):
            user = entry["user"]
            members.append({
                "user_id": user.id,
                "full_name": user.full_name,
                "is_you": user.id == request.user.id,
                "is_tour_creator": user.id == tour.created_by_id,
                "paid": str(entry["paid"]),
                "share": str(entry["share"]),
                "balance": str(entry["balance"]),
            })

        settle_up = []
        for item in suggestions:

            key = (item["from_user"].id, item["to_user"].id)
            open_request = pending.get(key)

            settle_up.append({
                "from_user_id": item["from_user"].id,
                "from_user_name": item["from_user"].full_name,
                "to_user_id": item["to_user"].id,
                "to_user_name": item["to_user"].full_name,
                "amount": str(item["amount"]),
                "is_payer": item["from_user"].id == request.user.id,
                "is_payee": item["to_user"].id == request.user.id,
                "pending_settlement": (
                    SettlementSerializer(open_request, context={"request": request}).data
                    if open_request else None
                ),
            })

        return Response({
            "tour_id": tour.id,
            "share_per_member": str(share_per_member),
            "total_expense": str(total_expense),
            "members": members,
            "settle_up": settle_up,
            "stripe_publishable_key": getattr(settings, "STRIPE_PUBLISHABLE_KEY", ""),
        })


class SettlementListCreateAPIView(generics.ListCreateAPIView):
    """List settlement activity for a tour, or start a cash, card, or Raast settlement."""

    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        return CreateSettlementSerializer if self.request.method == "POST" else SettlementSerializer

    def get_tour(self):
        return get_accessible_tour(self.request, self.kwargs["tour_id"])

    def get_queryset(self):
        tour = self.get_tour()
        return Settlement.objects.filter(tour=tour).select_related(
            "payer", "payee"
        )

    def create(self, request, *args, **kwargs):

        tour = self.get_tour()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payee = serializer.validated_data["payee"]

        if not is_tour_member(tour, payee):
            raise ValidationError({"payee": "That person isn't part of this tour."})

        settlement = serializer.save(tour=tour, payer=request.user)

        if settlement.method in (Settlement.METHOD_CASH, Settlement.METHOD_RAAST):

            method_label = "in cash" if settlement.method == Settlement.METHOD_CASH else "through Raast"

            notify(
                recipient=settlement.payee,
                actor=request.user,
                notif_type=Notification.TYPE_PAYMENT_REQUEST,
                message=(
                    f"{request.user.full_name} says they paid you "
                    f"PKR {settlement.amount} {method_label} for \"{tour.title}\". "
                    "Confirm you received it."
                ),
                tour=tour,
                settlement=settlement,
            )

        output = SettlementSerializer(settlement, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class SettlementDetailAPIView(generics.RetrieveAPIView):
    """Used for polling a settlement's status, e.g. after a Stripe redirect."""

    serializer_class = SettlementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Settlement.objects.filter(
            payer=self.request.user
        ) | Settlement.objects.filter(payee=self.request.user)


class RaastRecipientAPIView(APIView):
    """Reveal a Raast ID only to a member who currently owes that recipient."""

    permission_classes = [IsAuthenticated]

    def get(self, request, tour_id, payee_id):
        tour = get_accessible_tour(request, tour_id)

        payment = next((
            item for item in compute_settlement_suggestions(tour)
            if item["from_user"].id == request.user.id
            and item["to_user"].id == payee_id
        ), None)
        if payment is None:
            raise PermissionDenied("There is no Raast payment due to this member.")

        payee = payment["to_user"]
        if not payee.raast_id:
            raise ValidationError(
                {"detail": "This member has not added a Raast ID yet. Ask them to add it in their profile."}
            )

        return Response({
            "payee_name": payee.full_name,
            "raast_id": payee.raast_id,
        })


class SettlementApproveAPIView(APIView):
    """The payee confirms a manually paid cash or Raast settlement."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        settlement = get_object_or_404(Settlement, pk=pk)

        if settlement.payee_id != request.user.id:
            raise PermissionDenied("Only the person being paid can confirm this.")

        if settlement.method not in (Settlement.METHOD_CASH, Settlement.METHOD_RAAST):
            raise ValidationError("Only manual cash or Raast payments can be confirmed here.")

        if settlement.status != Settlement.STATUS_PENDING:
            raise ValidationError("This request has already been resolved.")

        settlement.status = Settlement.STATUS_APPROVED
        settlement.resolved_at = timezone.now()
        settlement.save(update_fields=["status", "resolved_at", "updated_at"])

        notify(
            recipient=settlement.payer,
            actor=request.user,
            notif_type=Notification.TYPE_PAYMENT_APPROVED,
            message=(
                f"{request.user.full_name} confirmed your PKR {settlement.amount} "
                f"{settlement.get_method_display().lower()} payment for \"{settlement.tour.title}\". You're settled up."
            ),
            tour=settlement.tour,
            settlement=settlement,
        )

        return Response(
            SettlementSerializer(settlement, context={"request": request}).data
        )


class SettlementRejectAPIView(APIView):
    """The payee says they never received a manual cash or Raast payment."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        settlement = get_object_or_404(Settlement, pk=pk)

        if settlement.payee_id != request.user.id:
            raise PermissionDenied("Only the person being paid can respond to this.")

        if settlement.method not in (Settlement.METHOD_CASH, Settlement.METHOD_RAAST):
            raise ValidationError("Only manual cash or Raast payments can be rejected here.")

        if settlement.status != Settlement.STATUS_PENDING:
            raise ValidationError("This request has already been resolved.")

        settlement.status = Settlement.STATUS_REJECTED
        settlement.resolved_at = timezone.now()
        settlement.save(update_fields=["status", "resolved_at", "updated_at"])

        notify(
            recipient=settlement.payer,
            actor=request.user,
            notif_type=Notification.TYPE_PAYMENT_REJECTED,
            message=(
                f"{request.user.full_name} said they haven't received your "
                f"PKR {settlement.amount} {settlement.get_method_display().lower()} payment for \"{settlement.tour.title}\". "
                "Double check with them."
            ),
            tour=settlement.tour,
            settlement=settlement,
        )

        return Response(
            SettlementSerializer(settlement, context={"request": request}).data
        )


class SettlementCheckoutAPIView(APIView):
    """Creates a Stripe Checkout session for a card settlement."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        settlement = get_object_or_404(Settlement, pk=pk)

        if settlement.payer_id != request.user.id:
            raise PermissionDenied("Only the person paying can start this checkout.")

        if settlement.method != Settlement.METHOD_CARD:
            raise ValidationError("This settlement isn't a card payment.")

        if settlement.status not in (Settlement.STATUS_PENDING,):
            raise ValidationError("This payment can't be started again.")

        if stripe is None or not stripe.api_key:
            raise ValidationError(
                "Card payments aren't configured yet. Add STRIPE_SECRET_KEY "
                "and STRIPE_PUBLISHABLE_KEY to the environment."
            )

        currency = getattr(settings, "STRIPE_CURRENCY", "usd")
        origin = request.data.get("origin") or request.build_absolute_uri("/")[:-1]

        success_url = (
            f"{origin}/tours/{settlement.tour_id}/"
            f"?settlement={settlement.id}&session_id={{CHECKOUT_SESSION_ID}}"
        )
        cancel_url = f"{origin}/tours/{settlement.tour_id}/?settlement_cancelled={settlement.id}"

        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": currency,
                        "unit_amount": int((settlement.amount * 100).to_integral_value()),
                        "product_data": {
                            "name": f"Settle up with {settlement.payee.full_name}",
                            "description": f"{settlement.tour.title} · PayTogether",
                        },
                    },
                    "quantity": 1,
                }],
                customer_email=request.user.email,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "settlement_id": str(settlement.id),
                    "tour_id": str(settlement.tour_id),
                    "payer_id": str(settlement.payer_id),
                    "payee_id": str(settlement.payee_id),
                },
            )
        except Exception as exc:  # noqa: BLE001 - surface Stripe's own message
            raise ValidationError({"detail": f"Stripe couldn't start checkout: {exc}"})

        settlement.stripe_checkout_session_id = session.id
        settlement.save(update_fields=["stripe_checkout_session_id", "updated_at"])

        return Response({"checkout_url": session.url, "session_id": session.id})


def _mark_settlement_paid(settlement, payment_intent_id=""):

    if settlement.status == Settlement.STATUS_PAID:
        return settlement

    settlement.status = Settlement.STATUS_PAID
    settlement.resolved_at = timezone.now()

    if payment_intent_id:
        settlement.stripe_payment_intent_id = payment_intent_id

    settlement.save(update_fields=[
        "status", "resolved_at", "stripe_payment_intent_id", "updated_at",
    ])

    notify(
        recipient=settlement.payee,
        actor=settlement.payer,
        notif_type=Notification.TYPE_PAYMENT_COMPLETED,
        message=(
            f"{settlement.payer.full_name} paid you PKR {settlement.amount} by "
            f"card for \"{settlement.tour.title}\". You're settled up."
        ),
        tour=settlement.tour,
        settlement=settlement,
    )

    notify(
        recipient=settlement.payer,
        actor=settlement.payer,
        notif_type=Notification.TYPE_PAYMENT_COMPLETED,
        message=(
            f"Your PKR {settlement.amount} card payment to "
            f"{settlement.payee.full_name} for \"{settlement.tour.title}\" went through."
        ),
        tour=settlement.tour,
        settlement=settlement,
    )

    return settlement


class SettlementConfirmAPIView(APIView):
    """
    Called by the browser right after Stripe redirects back with a
    session_id, so the payment shows as settled immediately even if the
    webhook hasn't arrived yet (or isn't configured in this environment).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        settlement = get_object_or_404(Settlement, pk=pk)

        if settlement.payer_id != request.user.id:
            raise PermissionDenied("You can't confirm someone else's payment.")

        session_id = request.data.get("session_id")

        if stripe is None or not stripe.api_key or not session_id:
            return Response(
                SettlementSerializer(settlement, context={"request": request}).data
            )

        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except Exception:  # noqa: BLE001
            return Response(
                SettlementSerializer(settlement, context={"request": request}).data
            )

        if (
            session.get("id") == settlement.stripe_checkout_session_id
            and session.get("payment_status") == "paid"
        ):
            _mark_settlement_paid(settlement, session.get("payment_intent") or "")

        return Response(
            SettlementSerializer(settlement, context={"request": request}).data
        )


class StripeWebhookAPIView(APIView):
    """Stripe calls this directly, so it has no session/JWT auth."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):

        if stripe is None or not stripe.api_key:
            return Response(status=status.HTTP_200_OK)

        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")

        try:
            if webhook_secret:
                event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            else:
                event = stripe.Event.construct_from(request.data, stripe.api_key)
        except Exception:  # noqa: BLE001
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if event["type"] == "checkout.session.completed":

            session = event["data"]["object"]
            settlement_id = (session.get("metadata") or {}).get("settlement_id")

            if settlement_id:
                try:
                    settlement = Settlement.objects.get(pk=settlement_id)
                    _mark_settlement_paid(settlement, session.get("payment_intent") or "")
                except Settlement.DoesNotExist:
                    pass

        return Response(status=status.HTTP_200_OK)


class NotificationListAPIView(generics.ListAPIView):

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(
            recipient=self.request.user
        ).select_related("actor", "tour", "settlement")[:30]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        unread_count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()

        return Response({
            "unread_count": unread_count,
            "results": self.get_serializer(queryset, many=True).data,
        })


class NotificationMarkReadAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "All caught up."})
