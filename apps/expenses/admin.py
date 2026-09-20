from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):

    list_display = (
        "tour",
        "paid_by",
        "amount",
        "category",
        "expense_date",
        "created_at",
    )

    list_filter = (
        "category",
        "expense_date",
    )

    search_fields = (
        "tour__title",
        "paid_by__full_name",
        "paid_by__email",
        "description",
    )

    ordering = ("-created_at",)
