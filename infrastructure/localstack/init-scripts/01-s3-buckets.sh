#!/bin/bash
set -e

awslocal s3 mb s3://raw-videos
awslocal s3 mb s3://transcoded-videos
awslocal s3 mb s3://thumbnails
awslocal s3 mb s3://static-assets

awslocal s3api put-bucket-cors --bucket raw-videos --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
    "AllowedMethods": ["GET","PUT","POST","DELETE","HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'

awslocal s3api put-bucket-cors --bucket transcoded-videos --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
    "AllowedMethods": ["GET","HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }]
}'

echo "LocalStack S3 buckets ready"
