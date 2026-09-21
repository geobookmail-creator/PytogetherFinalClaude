from django.test import TestCase
from django.urls import reverse

from .serializers import ProfileSerializer

class AuthenticationEntryPointTests(TestCase):
    def test_homepage_shows_the_login_page(self):
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "auth/login.html")


class RaastIdValidationTests(TestCase):
    def test_profile_rejects_an_invalid_raast_id(self):
        serializer = ProfileSerializer(data={"raast_id": "not-a-raast-id"}, partial=True)

        self.assertFalse(serializer.is_valid())
        self.assertIn("raast_id", serializer.errors)
