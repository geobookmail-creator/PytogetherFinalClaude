from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):

    list_display = (
        "tour",
        "generated_by",
        "total_expense",
        "member_count",
        "share_per_member",
        "generated_at",
    )

    list_filter = ("generated_at",)

    search_fields = ("tour__title", "generated_by__full_name")

    ordering = ("-generated_at",)
