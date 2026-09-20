from django.contrib import admin
from .models import Tour, TourMember

# Register your models here.


@admin.register(Tour)
class TourAdmin(admin.ModelAdmin):

    list_display = (
        "title",
        "destination",
        "created_by",
        "join_code",
        "status",
        "budget",
        "start_date",
        "end_date",
    )

    list_filter = (
        "status",
        "start_date",
    )

    search_fields = (
        "title",
        "destination",
    )

    ordering = (
        "-created_at",
    )


@admin.register(TourMember)
class TourMemberAdmin(admin.ModelAdmin):
    list_display = ("tour", "user", "joined_at")
    search_fields = ("tour__title", "user__email", "user__full_name")
    ordering = ("-joined_at",)
