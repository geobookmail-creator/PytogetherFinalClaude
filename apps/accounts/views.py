from django.shortcuts import render

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    ProfileSerializer,
    ChangePasswordSerializer,
)

from django.views.generic import TemplateView

from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
# Create your views here.

class RegisterPageView(TemplateView):
    template_name = "auth/register.html"

class LoginPageView(TemplateView):
    template_name = "auth/login.html"

class DashboardPageView(TemplateView):
    template_name = "dashboard/dashboard.html"

class ProfilePageView(TemplateView):
    template_name = "auth/profile.html"

class ProfileAPIView(APIView):

    permission_classes = [IsAuthenticated]

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):

        serializer = ProfileSerializer(
            request.user
        )

        return Response(serializer.data)

    def patch(self, request):

        serializer = ProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "success": True,
                "message": "Profile updated successfully.",
                "user": serializer.data,
            }
        )


class ChangePasswordAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "success": True,
                "message": "Password changed successfully.",
            }
        )

class RegisterAPIView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = RegisterSerializer(
            data=request.data
        )

        if serializer.is_valid():

            user = serializer.save()

            return Response(
                {
                    "success": True,
                    "message": "Registration successful.",

                    "user": {
                        "id": user.id,
                        "full_name": user.full_name,
                        "email": user.email,
                    }
                },
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class LoginAPIView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = LoginSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)

        return Response(

            {
                "success": True,

                "message": "Login successful.",

                "user": {
                    "id": user.id,
                    "full_name": user.full_name,
                    "email": user.email,
                },

                "tokens": {

                    "access": str(refresh.access_token),

                    "refresh": str(refresh),

                }

            }

        )