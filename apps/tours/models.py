from django.db import models
from django.conf import settings
from django.utils.crypto import get_random_string


def generate_join_code():
    """Generate a short, shareable code for a tour invitation."""
    return get_random_string(8, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

# Create your models here.


class Tour(models.Model):

    STATUS_CHOICES = [

        ("planned", "Planned"),

        ("ongoing", "Ongoing"),

        ("completed", "Completed"),

        ("cancelled", "Cancelled"),

    ]

    created_by = models.ForeignKey(

        settings.AUTH_USER_MODEL,

        on_delete=models.CASCADE,

        related_name="tours",

    )

    join_code = models.CharField(
        max_length=8,
        unique=True,
        default=generate_join_code,
        editable=False,
    )

    title = models.CharField(

        max_length=150

    )

    destination = models.CharField(

        max_length=150

    )

    image = models.ImageField(
    upload_to="tours/",
    blank=True,
    null=True
    )

    description = models.TextField(

        blank=True

    )

    budget = models.DecimalField(

        max_digits=10,

        decimal_places=2,

        default=0,

    )

    start_date = models.DateField()

    end_date = models.DateField()

    status = models.CharField(

        max_length=20,

        choices=STATUS_CHOICES,

        default="planned",

    )

    created_at = models.DateTimeField(

        auto_now_add=True

    )

    updated_at = models.DateTimeField(

        auto_now=True

    )

    class Meta:

        ordering = ["-created_at"]

        verbose_name = "Tour"

        verbose_name_plural = "Tours"

    def __str__(self):

        return self.title


class TourMember(models.Model):
    """A user who joined a tour using its invitation code."""

    tour = models.ForeignKey(
        Tour,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="joined_tour_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tour", "user"],
                name="unique_tour_member",
            )
        ]
        ordering = ["-joined_at"]

    def __str__(self):
        return f"{self.user} joined {self.tour}"
