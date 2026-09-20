from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

from apps.tours.models import Tour


class Expense(models.Model):
    """A single expense recorded by a member during a tour."""

    CATEGORY_CHOICES = [
        ("food", "Food"),
        ("transport", "Transport"),
        ("accommodation", "Accommodation"),
        ("activities", "Activities"),
        ("shopping", "Shopping"),
        ("other", "Other"),
    ]

    tour = models.ForeignKey(
        Tour,
        on_delete=models.CASCADE,
        related_name="expenses",
    )

    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses_paid",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
    )

    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default="other",
    )

    description = models.CharField(
        max_length=255,
        blank=True,
    )

    expense_date = models.DateField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "expenses"
        ordering = ["-expense_date", "-created_at"]
        verbose_name = "Expense"
        verbose_name_plural = "Expenses"

    def __str__(self):
        return f"{self.description or self.get_category_display()} - {self.amount}"
