from django.urls import path

from .views import ExpenseListCreateAPIView, ExpenseDetailAPIView

app_name = "expenses"

urlpatterns = [

    path(
        "api/tours/<int:tour_id>/expenses/",
        ExpenseListCreateAPIView.as_view(),
        name="tour-expense-list",
    ),

    path(
        "api/expenses/<int:pk>/",
        ExpenseDetailAPIView.as_view(),
        name="expense-detail",
    ),

]
