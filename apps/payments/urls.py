from django.urls import path

from .views import (
    NotificationListAPIView,
    NotificationMarkAllReadAPIView,
    NotificationMarkReadAPIView,
    SettlementApproveAPIView,
    SettlementCheckoutAPIView,
    SettlementConfirmAPIView,
    SettlementDetailAPIView,
    SettlementListCreateAPIView,
    SettlementRejectAPIView,
    StripeWebhookAPIView,
    TourBalancesAPIView,
)

app_name = "payments"

urlpatterns = [

    path(
        "api/tours/<int:tour_id>/balances/",
        TourBalancesAPIView.as_view(),
        name="tour-balances",
    ),

    path(
        "api/tours/<int:tour_id>/settlements/",
        SettlementListCreateAPIView.as_view(),
        name="tour-settlement-list",
    ),

    path(
        "api/settlements/<int:pk>/",
        SettlementDetailAPIView.as_view(),
        name="settlement-detail",
    ),

    path(
        "api/settlements/<int:pk>/approve/",
        SettlementApproveAPIView.as_view(),
        name="settlement-approve",
    ),

    path(
        "api/settlements/<int:pk>/reject/",
        SettlementRejectAPIView.as_view(),
        name="settlement-reject",
    ),

    path(
        "api/settlements/<int:pk>/checkout/",
        SettlementCheckoutAPIView.as_view(),
        name="settlement-checkout",
    ),

    path(
        "api/settlements/<int:pk>/confirm/",
        SettlementConfirmAPIView.as_view(),
        name="settlement-confirm",
    ),

    path(
        "api/payments/stripe/webhook/",
        StripeWebhookAPIView.as_view(),
        name="stripe-webhook",
    ),

    path(
        "api/notifications/",
        NotificationListAPIView.as_view(),
        name="notification-list",
    ),

    path(
        "api/notifications/<int:pk>/read/",
        NotificationMarkReadAPIView.as_view(),
        name="notification-read",
    ),

    path(
        "api/notifications/read-all/",
        NotificationMarkAllReadAPIView.as_view(),
        name="notification-read-all",
    ),

]
