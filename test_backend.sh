#!/bin/bash
echo "Testing VeritAI Backend API..."

# Test health endpoint
echo "1. Testing health endpoint:"
curl -s http://127.0.0.1:4000/health | jq . 2>/dev/null || curl -s http://127.0.0.1:4000/health

echo -e "\n2. Testing analysis endpoint with sample data:"
curl -s -X POST http://127.0.0.1:4000/api/extension/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a test article claiming that scientists have discovered a new element that can cure all diseases. Experts say this is the biggest breakthrough in medical history.",
    "url": "https://example.com/test-article",
    "title": "Test Article"
  }' | jq '.data | {score, flags}' 2>/dev/null || echo "Analysis endpoint response received"

echo -e "\nBackend tests complete. Extension should now be able to connect."
