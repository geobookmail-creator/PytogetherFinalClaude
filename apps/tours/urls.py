from django.urls import path
from .views import (
    CreateTourAPIView, TourListAPIView, CreateTourPageView, TourListPageView,
    TourDetailAPIView, TourDashboardAPIView, JoinTourAPIView, JoinTourPageView,
    tour_detail_page,
)

app_name = "tours"

urlpatterns = [

    path(
    "tours/<int:tour_id>/",
    tour_detail_page,
    name="tour-detail-page"
    ),


    path(
        "tours/",
        TourListPageView.as_view(),
        name="tour-list-page",
    ),

    path(
        "api/tours/<int:pk>/",
        TourDetailAPIView.as_view(),
        name="tour-detail-api"
    ),

    path(
        "api/tours/create/",
        CreateTourAPIView.as_view(),
        name="create-tour",
    ),

    path(
        "api/tours/join/",
        JoinTourAPIView.as_view(),
        name="join-tour",
    ),

    path(
        "api/tours/dashboard/",
        TourDashboardAPIView.as_view(),
        name="tour-dashboard",
    ),

    path(
        "api/tours/",
        TourListAPIView.as_view(),
        name="list-tours",
    ),

    path(
        "tours/create/",
        CreateTourPageView.as_view(),
        name="create-tour-page",
    ),

    path(
        "tours/join/",
        JoinTourPageView.as_view(),
        name="join-tour-page",
    ),

]
