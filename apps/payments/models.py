from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.tours.models import Tour


class Settlement(models.Model):
    """
    A record of one member settling (part of) what they owe to another
    member of the same tour, either by cash (needs the receiver's approval)
    or by card (charged straight away through Stripe).
    """

    METHOD_CASH = "cash"
    METHOD_CARD = "card"
    METHOD_RAAST = "raast"

    METHOD_CHOICES = [
        (METHOD_CASH, "Cash"),
        (METHOD_CARD, "Card"),
        (METHOD_RAAST, "Raast (manual)"),
    ]

    STATUS_PENDING = "pending"      # cash: waiting on the payee, card: checkout started
    STATUS_APPROVED = "approved"    # cash: payee confirmed they received it
    STATUS_PAID = "paid"            # card: Stripe confirmed the charge
    STATUS_REJECTED = "rejected"    # cash: payee said they didn't get it
    STATUS_CANCELLED = "cancelled"  # card: checkout abandoned / expired

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_PAID, "Paid"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    # Settlement amounts that count as "money has actually moved".
    SETTLED_STATUSES = [STATUS_APPROVED, STATUS_PAID]

    tour = models.ForeignKey(
        Tour,
        on_delete=models.CASCADE,
        related_name="settlements",
    )

    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settlements_paid",
        help_text="The member who owes money and is paying it off.",
    )

    payee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settlements_received",
        help_text="The member who is owed money and receiving the payment.",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
    )

    method = models.CharField(max_length=10, choices=METHOD_CHOICES)

    status = models.CharField(
        max_length=12,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )

    note = models.CharField(max_length=255, blank=True)

    # Stripe bookkeeping (card method only).
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "settlements"
        ordering = ["-created_at"]
        verbose_name = "Settlement"
        verbose_name_plural = "Settlements"

    def __str__(self):
        return f"{self.payer} -> {self.payee}: {self.amount} ({self.get_status_display()})"


class Notification(models.Model):
    """An in-app notification, mainly used for settlement requests/updates."""

    TYPE_PAYMENT_REQUEST = "payment_request"
    TYPE_PAYMENT_APPROVED = "payment_approved"
    TYPE_PAYMENT_REJECTED = "payment_rejected"
    TYPE_PAYMENT_COMPLETED = "payment_completed"

    TYPE_CHOICES = [
        (TYPE_PAYMENT_REQUEST, "Payment request"),
        (TYPE_PAYMENT_APPROVED, "Payment approved"),
        (TYPE_PAYMENT_REJECTED, "Payment rejected"),
        (TYPE_PAYMENT_COMPLETED, "Payment completed"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )

    notif_type = models.CharField(max_length=20, choices=TYPE_CHOICES)

    tour = models.ForeignKey(
        Tour,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )

    settlement = models.ForeignKey(
        Settlement,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )

    message = models.CharField(max_length=255)

    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"To {self.recipient}: {self.message}"
