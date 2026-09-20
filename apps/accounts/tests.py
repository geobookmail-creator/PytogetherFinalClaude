from django.test import TestCase
from django.urls import reverse

class AuthenticationEntryPointTests(TestCase):
    def test_homepage_shows_the_login_page(self):
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "auth/login.html")
