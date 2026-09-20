from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tours.models import Tour

from .models import Expense
from .serializers import ExpenseSerializer


def get_accessible_tour(request, tour_id):
    """Return the tour if the requesting user is its creator or a member."""

    tour = get_object_or_404(Tour, pk=tour_id)

    is_member = (
        tour.created_by_id == request.user.id
        or tour.members.filter(user=request.user).exists()
    )

    if not is_member:
        raise PermissionDenied(
            "You do not have access to this tour."
        )

    return tour


class ExpenseListCreateAPIView(generics.ListCreateAPIView):
    """List all expenses for a tour, or add a new expense to it."""

    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    # A single tour's expense list is shown in full, so it isn't paginated.
    pagination_class = None

    def get_tour(self):
        return get_accessible_tour(self.request, self.kwargs["tour_id"])

    def get_queryset(self):
        tour = self.get_tour()
        return Expense.objects.filter(tour=tour).select_related("paid_by")

    def perform_create(self, serializer):
        tour = self.get_tour()
        serializer.save(tour=tour, paid_by=self.request.user)


class ExpenseDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, edit, or delete a single expense."""

    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(
            Q(tour__created_by=self.request.user) | Q(tour__members__user=self.request.user)
        ).distinct().select_related("paid_by", "tour")

    def check_edit_permission(self, expense):
        is_expense_owner = expense.paid_by_id == self.request.user.id
        is_tour_owner = expense.tour.created_by_id == self.request.user.id

        if not (is_expense_owner or is_tour_owner):
            raise PermissionDenied(
                "Only the person who added this expense or the tour creator can modify it."
            )

    def perform_update(self, serializer):
        self.check_edit_permission(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self.check_edit_permission(instance)
        instance.delete()
