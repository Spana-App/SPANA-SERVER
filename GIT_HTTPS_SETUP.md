# 🔐 Setup HTTPS with Personal Access Token

Since you're an organization member but don't have write access via SSH, try using HTTPS with a Personal Access Token.

## Steps:

1. **Create a Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Name: "Spana Backend Access"
   - Expiration: Choose your preference (90 days recommended)
   - Select scopes: Check `repo` (Full control of private repositories)
   - Click "Generate token"
   - **COPY THE TOKEN** (you won't see it again!)

2. **Change remote to HTTPS:**
   ```bash
   git remote set-url origin https://github.com/Spana-App/SPANA-SERVER.git
   ```

3. **Verify the change:**
   ```bash
   git remote -v
   ```
   Should show: `origin  https://github.com/Spana-App/SPANA-SERVER.git`

4. **Try pushing:**
   ```bash
   git push --set-upstream origin main
   ```

5. **When prompted for credentials:**
   - Username: `ItsEks`
   - Password: **Paste your Personal Access Token** (NOT your GitHub password)

## If it still doesn't work:

The organization might have restrictions. You'll need to contact Alison to grant write access.


