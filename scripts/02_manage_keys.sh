#!/bin/bash
set -euo pipefail

APIM_NAME="apim-eduelden-ai"
RG="rg-powerplatform-billing"
ACTION="${1:-list}"

case "$ACTION" in
  create)
    echo "=== 학생 구독 50개 생성 ==="
    for i in $(seq -w 1 50); do
      echo "Creating sub-student-$i..."
      az apim subscription create \
        --resource-group "$RG" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --display-name "Student $i" \
        --scope "/apis" \
        --state active \
        --output none
    done
    echo "=== 50개 구독 생성 완료 ==="
    ;;
  export)
    echo "=== 학생 키 CSV 내보내기 ==="
    OUTPUT_FILE="${2:-student_keys.csv}"
    echo "student_id,subscription_id,primary_key,secondary_key" > "$OUTPUT_FILE"
    for i in $(seq -w 1 50); do
      KEYS=$(az apim subscription keys list \
        --resource-group "$RG" \
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
    echo "=== 학생 키 일괄 비활성화 ==="
    for i in $(seq -w 1 50); do
      az apim subscription update \
        --resource-group "$RG" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --state suspended \
        --output none
      echo "Disabled sub-student-$i"
    done
    ;;
  enable)
    echo "=== 학생 키 일괄 활성화 ==="
    for i in $(seq -w 1 50); do
      az apim subscription update \
        --resource-group "$RG" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --state active \
        --output none
      echo "Enabled sub-student-$i"
    done
    ;;
  regenerate)
    echo "=== 학생 키 일괄 재발급 ==="
    for i in $(seq -w 1 50); do
      az apim subscription keys regenerate-primary-key \
        --resource-group "$RG" \
        --service-name "$APIM_NAME" \
        --subscription-id "sub-student-$i" \
        --output none
      echo "Regenerated sub-student-$i"
    done
    ;;
  list)
    echo "=== 학생 구독 목록 ==="
    az apim subscription list \
      --resource-group "$RG" \
      --service-name "$APIM_NAME" \
      --query "[?starts_with(displayName,'Student')].{name:displayName,state:state,id:name}" \
      --output table
    ;;
  *)
    echo "Usage: $0 {create|export|disable|enable|regenerate|list}"
    exit 1
    ;;
esac
