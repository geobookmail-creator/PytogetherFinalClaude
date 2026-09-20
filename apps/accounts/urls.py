from django.urls import path

from .views import (
    RegisterAPIView,
    RegisterPageView,
    LoginAPIView,
    LoginPageView,
    DashboardPageView,
    ProfileAPIView,
    ProfilePageView,
    ChangePasswordAPIView,
)


app_name = "accounts"

urlpatterns = [

    path(
        "register/",
        RegisterPageView.as_view(),
        name="register-page",
    ),

    path(
        "login/",
        LoginPageView.as_view(),
        name="login-page",
    ),

    path(
        "api/register/",
        RegisterAPIView.as_view(),
        name="register",
    ),

    path(
        "api/login/",
        LoginAPIView.as_view(),
        name="login-api",
    ),

    path(
        "dashboard/",
        DashboardPageView.as_view(),
        name="dashboard",
    ),

    path(
        "api/profile/",
        ProfileAPIView.as_view(),
        name="profile-api",
    ),

    path(
        "api/profile/change-password/",
        ChangePasswordAPIView.as_view(),
        name="change-password-api",
    ),

    path(
        "profile/",
        ProfilePageView.as_view(),
        name="profile-page",
    ),

]