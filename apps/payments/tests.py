from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.expenses.models import Expense
from apps.tours.models import Tour, TourMember

from .models import Notification, Settlement


class RaastSettlementAPITests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.payer = user_model.objects.create_user(
            email="payer@example.com", password="password123", full_name="Payer"
        )
        self.payee = user_model.objects.create_user(
            email="payee@example.com",
            password="password123",
            full_name="Payee",
            raast_id="03001234567",
        )
        self.tour = Tour.objects.create(
            created_by=self.payer,
            title="Northern Trip",
            destination="Hunza",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 5),
        )
        TourMember.objects.create(tour=self.tour, user=self.payee)
        Expense.objects.create(
            tour=self.tour,
            paid_by=self.payee,
            amount="200.00",
            category="food",
            description="Dinner",
            expense_date=date(2026, 10, 2),
        )

    def test_payer_can_reveal_an_owed_member_raast_id(self):
        self.client.force_authenticate(self.payer)

        response = self.client.get(
            f"/api/tours/{self.tour.id}/settlements/raast-recipient/{self.payee.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["raast_id"], "03001234567")
        self.assertEqual(response.data["payee_name"], "Payee")

    def test_raast_payment_needs_the_payee_to_confirm(self):
        self.client.force_authenticate(self.payer)
        response = self.client.post(
            f"/api/tours/{self.tour.id}/settlements/",
            {"payee": self.payee.id, "amount": "100.00", "method": "raast"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        settlement = Settlement.objects.get(pk=response.data["id"])
        self.assertEqual(settlement.status, Settlement.STATUS_PENDING)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.payee,
                settlement=settlement,
                notif_type=Notification.TYPE_PAYMENT_REQUEST,
            ).exists()
        )

        self.client.force_authenticate(self.payee)
        response = self.client.post(f"/api/settlements/{settlement.id}/approve/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        settlement.refresh_from_db()
        self.assertEqual(settlement.status, Settlement.STATUS_APPROVED)
