from django.urls import path

from .views import TourReportAPIView

app_name = "reports"

urlpatterns = [

    path(
        "api/tours/<int:tour_id>/report/",
        TourReportAPIView.as_view(),
        name="tour-report",
    ),

]
