from rest_framework import serializers

from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):

    paid_by_name = serializers.CharField(
        source="paid_by.full_name",
        read_only=True,
    )

    category_display = serializers.CharField(
        source="get_category_display",
        read_only=True,
    )

    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Expense

        fields = [
            "id",
            "tour",
            "paid_by",
            "paid_by_name",
            "amount",
            "category",
            "category_display",
            "description",
            "expense_date",
            "is_owner",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "tour",
            "paid_by",
            "created_at",
            "updated_at",
        ]

    def get_is_owner(self, expense):
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and expense.paid_by_id == request.user.id
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Amount must be greater than zero."
            )
        return value
