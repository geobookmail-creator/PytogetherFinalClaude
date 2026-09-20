from rest_framework import serializers

from .models import Notification, Settlement


class SettlementSerializer(serializers.ModelSerializer):

    payer_name = serializers.CharField(source="payer.full_name", read_only=True)
    payee_name = serializers.CharField(source="payee.full_name", read_only=True)
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_payer = serializers.SerializerMethodField()
    is_payee = serializers.SerializerMethodField()

    class Meta:
        model = Settlement
        fields = [
            "id", "tour", "payer", "payer_name", "payee", "payee_name",
            "amount", "method", "method_display", "status", "status_display",
            "note", "is_payer", "is_payee", "created_at", "updated_at",
            "resolved_at",
        ]
        read_only_fields = [
            "id", "tour", "payer", "status", "created_at", "updated_at",
            "resolved_at",
        ]

    def get_is_payer(self, settlement):
        request = self.context.get("request")
        return bool(request and settlement.payer_id == request.user.id)

    def get_is_payee(self, settlement):
        request = self.context.get("request")
        return bool(request and settlement.payee_id == request.user.id)


class CreateSettlementSerializer(serializers.ModelSerializer):

    class Meta:
        model = Settlement
        fields = ["payee", "amount", "method", "note"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter an amount greater than zero.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        payee = attrs.get("payee")

        if payee and request and payee.id == request.user.id:
            raise serializers.ValidationError(
                {"payee": "You can't pay yourself."}
            )

        return attrs


class NotificationSerializer(serializers.ModelSerializer):

    actor_name = serializers.CharField(source="actor.full_name", read_only=True)
    tour_title = serializers.CharField(source="tour.title", read_only=True)
    settlement = SettlementSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id", "notif_type", "message", "actor", "actor_name", "tour",
            "tour_title", "settlement", "is_read", "created_at",
        ]
        read_only_fields = fields
