#!/bin/bash
set -e

# Live + replay segments share one prefix per session: the live segments ARE
# the replay segments. There is intentionally NO lifecycle rule — retention is
# app-driven (live-service deletes errored/old session prefixes). A lifecycle
# rule here would delete replays.
awslocal s3 mb s3://live-segments

# Public-read for dev (CloudFront OAC in production).
awslocal s3api put-bucket-policy \
  --bucket live-segments \
  --policy '{
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::live-segments/*"
    }]
  }'

awslocal s3api put-bucket-cors --bucket live-segments --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}'

echo "Phase 5: live-segments bucket ready"
