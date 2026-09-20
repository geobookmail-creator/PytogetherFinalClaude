from django.shortcuts import render
from django.views.generic import TemplateView
# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.exceptions import PermissionDenied
from django.db import IntegrityError
from django.db.models import Q, Sum
from decimal import Decimal, ROUND_HALF_UP
import re



from .models import Tour, TourMember
from .serializers import TourSerializer
from rest_framework import generics

from .pagination import TourPagination

from rest_framework.parsers import (
    MultiPartParser,
    FormParser,
)


def tour_detail_page(request, tour_id):

    return render(
        request,
        "tours/tour-detail.html",
        {
            "tour_id": tour_id
        }
    )

def edit_tour_page(request, tour_id):

    return render(
        request,
        "tours/edit-tour.html",
        {
            "tour_id": tour_id
        }
    )


class JoinTourPageView(TemplateView):
    template_name = "tours/join-tour.html"

class TourDetailAPIView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = TourSerializer

    permission_classes = [
        IsAuthenticated
    ]

    parser_classes = [
        MultiPartParser,
        FormParser
    ]

    def get_queryset(self):

        return Tour.objects.filter(
            Q(created_by=self.request.user) | Q(members__user=self.request.user)
        ).distinct()

    def perform_update(self, serializer):
        if serializer.instance.created_by_id != self.request.user.id:
            raise PermissionDenied("Only the tour creator can update this tour.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.created_by_id != self.request.user.id:
            raise PermissionDenied("Only the tour creator can delete this tour.")
        instance.delete()

class TourListPageView(TemplateView):
    template_name = "tours/tour-list.html"

class CreateTourPageView(TemplateView):

    template_name = "tours/create-tour.html"


class TourListAPIView(generics.ListAPIView):

    serializer_class = TourSerializer

    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser
    ]

    pagination_class = TourPagination

    filter_backends = [
        SearchFilter,
        OrderingFilter,
    ]

    search_fields = [
        "title",
        "destination",
        "status",
    ]

    ordering_fields = [
        "created_at",
        "budget",
        "start_date",
    ]

    ordering = [
        "-created_at",
    ]

    def get_queryset(self):

        return Tour.objects.filter(
            created_by=self.request.user
        ).order_by("-created_at")

class CreateTourAPIView(generics.CreateAPIView):
    serializer_class = TourSerializer
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser
    ]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class JoinTourAPIView(APIView):
    """Join a tour using its unique invitation code."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        join_code = str(request.data.get("join_code", "")).strip().upper()

        if not join_code:
            return Response(
                {"join_code": ["A join code is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not re.fullmatch(r"[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}", join_code):
            return Response(
                {"join_code": ["Enter a valid eight-character join code."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            tour = Tour.objects.get(join_code=join_code)
        except Tour.DoesNotExist:
            return Response(
                {"detail": "No tour was found for this join code."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if TourMember.objects.filter(tour=tour, user=request.user).exists():
            return Response(
                {"detail": "You have already joined this tour."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            membership = TourMember.objects.create(tour=tour, user=request.user)
        except IntegrityError:
            # The database constraint also protects against simultaneous requests.
            return Response(
                {"detail": "You have already joined this tour."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {
                "success": True,
                "message": "You joined the tour successfully.",
                "tour": TourSerializer(tour, context={"request": request}).data,
                "joined_at": membership.joined_at,
            },
            status=status.HTTP_201_CREATED,
        )


class TourDashboardAPIView(APIView):
    """
    Return the user's created and joined tours, plus the headline numbers
    shown on the dashboard cards.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        created_tours = Tour.objects.filter(created_by=request.user)
        joined_tours = Tour.objects.filter(members__user=request.user).distinct()
        serializer_context = {"request": request}

        all_tours = list(created_tours) + list(joined_tours)

        total_expense = Decimal("0")
        total_paid_by_user = Decimal("0")
        total_share_of_user = Decimal("0")
        people = set()

        for tour in all_tours:
            tour_total = tour.expenses.aggregate(total=Sum("amount"))["total"] or Decimal("0")
            total_expense += tour_total

            member_ids = {tour.created_by_id}
            member_ids.update(
                tour.members.values_list("user_id", flat=True)
            )
            people.update(member_ids)

            member_count = len(member_ids) or 1
            total_share_of_user += tour_total / member_count

            paid = tour.expenses.filter(paid_by=request.user).aggregate(
                total=Sum("amount")
            )["total"] or Decimal("0")
            total_paid_by_user += paid

        # The user themselves are not someone they split with.
        people.discard(request.user.id)

        def money(value):
            return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

        return Response(
            {
                "created_tours": TourSerializer(created_tours, many=True, context=serializer_context).data,
                "joined_tours": TourSerializer(joined_tours, many=True, context=serializer_context).data,
                "summary": {
                    "total_tours": len(all_tours),
                    "total_people": len(people),
                    "total_expense": money(total_expense),
                    "you_paid": money(total_paid_by_user),
                    "your_share": money(total_share_of_user),
                    "balance": money(total_paid_by_user - total_share_of_user),
                },
            }
        )


# class CreateTourAPIView(APIView):

#     permission_classes = [IsAuthenticated]

#     def post(self, request):

#         serializer = TourSerializer(
#             data=request.data
#         )

#         if serializer.is_valid():

#             tour = serializer.save(
#                 created_by=request.user
#             )

#             return Response(

#                 {
#                     "success": True,

#                     "message": "Tour created successfully.",

#                     "tour": TourSerializer(tour).data,

#                 },

#                 status=status.HTTP_201_CREATED,

#             )

#         return Response(

#             serializer.errors,

#             status=status.HTTP_400_BAD_REQUEST,

#         )
