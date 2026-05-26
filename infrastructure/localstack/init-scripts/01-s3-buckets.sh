#!/bin/bash
set -e

awslocal s3 mb s3://raw-videos
awslocal s3 mb s3://transcoded-videos
awslocal s3 mb s3://thumbnails
awslocal s3 mb s3://static-assets

awslocal s3api put-bucket-cors --bucket raw-videos --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET","PUT","POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'

echo "LocalStack S3 buckets ready"
