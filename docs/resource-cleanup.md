# 수업 후 리소스 정리 절차

> 수업 종료 후 비용 절감을 위해 다음 순서로 정리합니다.

## 1. 학생 키 비활성화 (즉시)

```bash
# GitHub Actions에서 실행
# Actions → Key Management → disable-all 선택

# 또는 CLI에서 직접
bash scripts/02_manage_keys.sh disable
```

## 2. 모델 배포 삭제

```bash
RG="rg-powerplatform-billing"
RESOURCE="eduelden-ai-resource"

az cognitiveservices account deployment delete --name $RESOURCE --resource-group $RG --deployment-name gpt-55
az cognitiveservices account deployment delete --name $RESOURCE --resource-group $RG --deployment-name gpt-54-mini
az cognitiveservices account deployment delete --name $RESOURCE --resource-group $RG --deployment-name deepseek-v4-flash-1
az cognitiveservices account deployment delete --name $RESOURCE --resource-group $RG --deployment-name deepseek-v4-flash-2
```

## 3. APIM 인스턴스 삭제 (~$50/월 절감)

```bash
az apim delete --name apim-eduelden-ai --resource-group $RG --yes
```

## 4. 예산 알림 비활성화 (선택)

Azure Portal → Cost Management → Budgets → eduelden-ai-budget → 비활성화

## 5. 보안그룹 RBAC 회수 (선택)

```bash
az role assignment delete --assignee "fb846a9f-3a6d-4174-a318-e6243cb593ff" \
  --role "Cognitive Services User" \
  --scope "/subscriptions/3354f2f5-e261-49af-9ead-2c6938f447a3/resourceGroups/rg-powerplatform-billing/providers/Microsoft.CognitiveServices/accounts/eduelden-ai-resource"
```

## 정리 순서 요약

1. 키 비활성화 (즉시, 비용 0)
2. 모델 삭제 (사용량 과금 중단)
3. APIM 삭제 (월 $50 절감)
4. 예산/RBAC 정리 (선택)
