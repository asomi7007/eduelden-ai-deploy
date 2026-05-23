#!/bin/bash
set -euo pipefail

# Load config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$(dirname "$SCRIPT_DIR")/config.env"
if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
else
  echo "WARNING: config.env not found. Using defaults."
fi

APIM_NAME="${APIM_NAME:-apim-eduelden-ai}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-powerplatform-billing}"
STUDENT_COUNT="${STUDENT_COUNT:-50}"
ACTION="${1:-list}"

case "$ACTION" in
  create)
    echo "=== Creating $STUDENT_COUNT student subscriptions ==="
    for i in $(seq -w 1 "$STUDENT_COUNT"); do
      echo "Creating sub-student-$i..."
      az apim subscription create \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --display-name "Student $i" \
        --scope "/apis" \
        --state active \
        --output none
    done
    echo "=== $STUDENT_COUNT subscriptions created ==="
    ;;
  export)
    echo "=== Exporting student keys to CSV ==="
    OUTPUT_FILE="${2:-student_keys.csv}"
    echo "student_id,subscription_id,primary_key,secondary_key" > "$OUTPUT_FILE"
    for i in $(seq -w 1 "$STUDENT_COUNT"); do
      KEYS=$(az apim subscription keys list \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --output json)
      PK=$(echo "$KEYS" | jq -r '.primaryKey')
      SK=$(echo "$KEYS" | jq -r '.secondaryKey')
      echo "$i,sub-student-$i,$PK,$SK" >> "$OUTPUT_FILE"
    done
    echo "Exported to $OUTPUT_FILE"
    ;;
  disable)
    echo "=== Disabling all student keys ==="
    for i in $(seq -w 1 "$STUDENT_COUNT"); do
      az apim subscription update \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --state suspended \
        --output none
      echo "Disabled sub-student-$i"
    done
    ;;
  enable)
    echo "=== Enabling all student keys ==="
    for i in $(seq -w 1 "$STUDENT_COUNT"); do
      az apim subscription update \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --state active \
        --output none
      echo "Enabled sub-student-$i"
    done
    ;;
  regenerate)
    echo "=== Regenerating all student keys ==="
    for i in $(seq -w 1 "$STUDENT_COUNT"); do
      az apim subscription keys regenerate-primary-key \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --output none
      echo "Regenerated sub-student-$i"
    done
    ;;
  list)
    echo "=== Student subscriptions ==="
    az apim subscription list \
      --resource-group "$RESOURCE_GROUP" \
      --service-name "$APIM_NAME" \
      --query "[?starts_with(displayName,'Student')].{name:displayName,state:state,id:name}" \
      --output table
    ;;
  *)
    echo "Usage: $0 {create|export|disable|enable|regenerate|list}"
    exit 1
    ;;
esac
