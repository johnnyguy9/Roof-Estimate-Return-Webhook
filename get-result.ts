cd Roof-Estimate-Return-Webhook  # Your repo folder

# Add the file
cp get-result.ts api/get-result.ts

# Commit and push
git add api/get-result.ts
git commit -m "Add GET endpoint for polling"
git push origin main
```

### 2. Wait for Vercel to deploy (~2 minutes)

Go to your Vercel dashboard and watch the deployment.

### 3. Test the endpoint directly

After deployment, test it in your browser:
```
https://roof-estimate-return-webhook-ge3l.vercel.app/api/get-result?callbackId=test123
