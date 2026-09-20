from django.urls import path

from .views import edit_tour_page

app_name = "tours_page"

urlpatterns = [

    path(
        "tours/edit/<int:tour_id>/",
        edit_tour_page,
        name="edit-tour"
    ),

]
