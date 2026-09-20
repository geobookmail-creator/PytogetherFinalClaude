from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.shortcuts import get_object_or_404

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tours.models import Tour
from apps.expenses.models import Expense
from apps.expenses.views import get_accessible_tour
from apps.payments.models import Settlement

from .models import Report


def _money(value):
    return Decimal(value or 0).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class TourReportAPIView(APIView):
    """
    Build and return the final expense report for a tour:
    total spent, each member's share, and who owes / is owed money.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tour_id):
        tour = get_accessible_tour(request, tour_id)

        expenses = Expense.objects.filter(tour=tour).select_related("paid_by")

        total_expense = _money(
            expenses.aggregate(total=Sum("amount"))["total"] or 0
        )

        member_users = {tour.created_by}
        for membership in tour.members.select_related("user"):
            member_users.add(membership.user)

        member_count = len(member_users) or 1
        share_per_member = _money(total_expense / member_count)

        paid_by_user = {}
        for expense in expenses:
            paid_by_user[expense.paid_by_id] = paid_by_user.get(
                expense.paid_by_id, Decimal("0")
            ) + expense.amount

        # Cash payments the payee has confirmed, and card payments Stripe
        # has confirmed, count as money that has actually moved between
        # members, so they shift the balance the same way an expense would.
        settled_out = {}
        settled_in = {}
        for settlement in Settlement.objects.filter(
            tour=tour, status__in=Settlement.SETTLED_STATUSES
        ):
            settled_out[settlement.payer_id] = settled_out.get(
                settlement.payer_id, Decimal("0")
            ) + settlement.amount
            settled_in[settlement.payee_id] = settled_in.get(
                settlement.payee_id, Decimal("0")
            ) + settlement.amount

        breakdown = []
        for user in sorted(member_users, key=lambda u: u.full_name.lower()):
            paid = _money(paid_by_user.get(user.id, 0))
            adjustment = _money(
                settled_out.get(user.id, 0) - settled_in.get(user.id, 0)
            )
            balance = _money(paid + adjustment - share_per_member)

            if balance > 0:
                status_label = "gets back"
            elif balance < 0:
                status_label = "owes"
            else:
                status_label = "settled"

            breakdown.append(
                {
                    "user_id": user.id,
                    "full_name": user.full_name,
                    "is_tour_creator": user.id == tour.created_by_id,
                    "paid": str(paid),
                    "share": str(share_per_member),
                    "balance": str(balance),
                    "status": status_label,
                }
            )

        category_totals = {}
        for expense in expenses:
            category_totals[expense.category] = category_totals.get(
                expense.category, Decimal("0")
            ) + expense.amount
        category_breakdown = [
            {"category": category, "total": str(_money(total))}
            for category, total in category_totals.items()
        ]

        report = Report.objects.create(
            tour=tour,
            generated_by=request.user,
            total_expense=total_expense,
            member_count=member_count,
            share_per_member=share_per_member,
            breakdown=breakdown,
        )

        return Response(
            {
                "tour_id": tour.id,
                "tour_title": tour.title,
                "total_expense": str(total_expense),
                "member_count": member_count,
                "share_per_member": str(share_per_member),
                "expense_count": expenses.count(),
                "members": breakdown,
                "category_breakdown": category_breakdown,
                "generated_at": report.generated_at,
            }
        )
