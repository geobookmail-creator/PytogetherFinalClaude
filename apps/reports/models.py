from django.db import models
from django.conf import settings

from apps.tours.models import Tour


class Report(models.Model):
    """A saved snapshot of a tour's expense report."""

    tour = models.ForeignKey(
        Tour,
        on_delete=models.CASCADE,
        related_name="reports",
    )

    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="generated_reports",
    )

    total_expense = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    member_count = models.PositiveIntegerField(default=0)

    share_per_member = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    breakdown = models.JSONField(default=list, blank=True)

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reports"
        ordering = ["-generated_at"]
        verbose_name = "Report"
        verbose_name_plural = "Reports"

    def __str__(self):
        return f"Report for {self.tour.title} ({self.generated_at:%Y-%m-%d})"
