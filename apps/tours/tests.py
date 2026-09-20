from datetime import date

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Tour, TourMember


class JoinTourAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.creator = User.objects.create_user(
            email="creator@example.com", password="password123", full_name="Creator"
        )
        self.member = User.objects.create_user(
            email="member@example.com", password="password123", full_name="Member"
        )
        self.tour = Tour.objects.create(
            created_by=self.creator,
            title="Northern Trip",
            destination="Hunza",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 5),
        )
        self.url = "/api/tours/join/"

    def authenticate_member(self):
        self.client.force_authenticate(user=self.member)

    def test_unauthenticated_user_cannot_join(self):
        response = self.client.post(self.url, {"join_code": self.tour.join_code}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_code_is_rejected(self):
        self.authenticate_member()
        response = self.client.post(self.url, {"join_code": ""}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("join_code", response.data)

    def test_invalid_code_is_rejected(self):
        self.authenticate_member()
        response = self.client.post(self.url, {"join_code": "not-valid"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_tour_code_returns_not_found(self):
        self.authenticate_member()
        response = self.client.post(self.url, {"join_code": "ABCDEFGH"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_valid_code_creates_membership_and_returns_tour(self):
        self.authenticate_member()
        response = self.client.post(self.url, {"join_code": self.tour.join_code.lower()}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["tour"]["id"], self.tour.id)
        self.assertEqual(response.data["tour"]["join_code"], self.tour.join_code)
        self.assertTrue(TourMember.objects.filter(tour=self.tour, user=self.member).exists())

    def test_already_joined_returns_conflict(self):
        TourMember.objects.create(tour=self.tour, user=self.member)
        self.authenticate_member()
        response = self.client.post(self.url, {"join_code": self.tour.join_code}, format="json")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_tour_member_unique_constraint(self):
        TourMember.objects.create(tour=self.tour, user=self.member)
        with self.assertRaises(IntegrityError):
            TourMember.objects.create(tour=self.tour, user=self.member)

    def test_dashboard_separates_created_and_joined_tours(self):
        TourMember.objects.create(tour=self.tour, user=self.member)
        self.authenticate_member()
        response = self.client.get("/api/tours/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created_tours"], [])
        self.assertEqual(response.data["joined_tours"][0]["id"], self.tour.id)
