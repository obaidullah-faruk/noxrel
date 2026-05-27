#!/bin/bash
# Phase 4A: Make transcoded-video segments publicly readable (dev only).
# In production (Phase 4B) this script is removed and CloudFront OAC
# becomes the only allowed principal.

set -e

awslocal s3api put-bucket-policy \
  --bucket transcoded-videos \
  --policy '{
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::transcoded-videos/*"
    }]
  }'

echo "Phase 4A: transcoded-videos bucket is public-read (dev only)"
