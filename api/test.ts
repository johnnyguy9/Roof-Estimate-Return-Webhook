export default function handler(req: any, res: any) {
  res.status(200).json({ message: "API is working!" });
}
```

Then test: `https://roof-estimate-return-webhook-ge3l.vercel.app/api/test`

If this works but `estimate-callback` doesn't, there's something wrong with the callback file.

---

## 🎯 ALSO CHECK:

In your Vercel deployment logs, do you see:
```
✓ api/estimate-callback.ts
