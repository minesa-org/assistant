# Discord Linked Roles Setup Guide

This guide explains how to set up and use Discord Linked Roles with the mini-interaction package.

## Overview

This application implements Discord Linked Roles with a database backend to manage user metadata. Users can connect their Discord account via OAuth2, and their role connection metadata will be automatically updated based on their assistant status stored in the database.

## Features

-   ✅ OAuth2 authentication flow for Discord
-   ✅ Database storage (JSON or MongoDB) for user metadata
-   ✅ Automatic metadata synchronization with Discord
-   ✅ Commands to manage and view assistant status
-   ✅ Linked role based on `is_assistant` metadata field

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```env
DISCORD_APPLICATION_ID=your_application_id
DISCORD_APP_PUBLIC_KEY=your_public_key
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=https://your-app.vercel.app/api/discord-oauth-callback
COOKIE_SECRET=your-random-secret-key-here
DATABASE_TYPE=json
DATABASE_PATH=./data
```

**For MongoDB (optional):**

```env
DATABASE_TYPE=mongodb
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGO_DB_NAME=assistant
MONGO_COLLECTION_NAME=users
```

### 2. Discord Developer Portal Configuration

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to **OAuth2** → **General**
4. Add your **Redirect URI**: `https://your-app.vercel.app/api/discord-oauth-callback`
5. Navigate to **OAuth2** → **Linked Roles**
6. Set the **Verification URL**: `https://your-app.vercel.app/`
7. Verify that your metadata is registered (the app does this automatically)

**Important:** These are two different URLs:

-   **Redirect URI** (`/api/discord-oauth-callback`): Where Discord sends users after authorization
-   **Verification URL** (`/`): The landing page where users start the OAuth flow

### 3. Deploy to Vercel

```bash
# Build the project
npm run build

# Deploy to Vercel
vercel --prod
```

### 4. Register Commands

After deployment, register the commands with Discord:

```bash
npm run register
```

## Available Commands

### `/link-role`

Generates an OAuth2 link for users to connect their Discord account and enable linked roles.

**Usage:**

```
/link-role
```

**Response:**

-   Provides a clickable OAuth2 authorization link
-   User clicks the link and authorizes the app
-   User is redirected to the callback page
-   Metadata is automatically synced with Discord

### `/set-assistant`

Sets a user's assistant status in the database.

**Usage:**

```
/set-assistant user:@username status:true
```

**Parameters:**

-   `user` (required): The user to set the status for
-   `status` (required): Choose "True (Is Assistant)" or "False (Not Assistant)"

**Permissions:**

-   This command should be restricted to administrators in your server settings

### `/view-assistant`

Views a user's assistant status from the database.

**Usage:**

```
/view-assistant
/view-assistant user:@username
```

**Parameters:**

-   `user` (optional): The user to check. If not provided, checks your own status

**Response:**

-   Shows the user's current assistant status
-   Displays when the status was last updated

## How It Works

### 1. Metadata Registration

The application automatically registers the linked role metadata with Discord when it starts:

```typescript
{
  key: "is_assistant",
  name: "Is Assistant?",
  description: "Is the user an assistant?",
  type: RoleConnectionMetadataTypes.BooleanEqual
}
```

### 2. OAuth Flow

1. User runs `/link-role` command
2. User clicks the OAuth2 authorization link
3. User authorizes the app with `identify` and `role_connections.write` scopes
4. Discord redirects to `/api/discord-oauth-callback`
5. App exchanges the code for access tokens
6. App fetches user data from the database
7. App updates Discord metadata via the API

### 3. Database Structure

User data is stored with the following schema:

```typescript
{
  userId: string,           // Discord user ID
  is_assistant: boolean,    // Assistant status
  updatedAt: number        // Timestamp of last update
}
```

### 4. Metadata Update

When a user connects via OAuth, the app sends this to Discord:

```json
{
	"platform_name": "Assistant App",
	"platform_username": "user_id",
	"metadata": {
		"is_assistant": 1 // or 0 for false
	}
}
```

## Setting Up Linked Roles in Your Server

1. Go to your Discord server settings
2. Navigate to **Roles**
3. Create or edit a role
4. Scroll down to **Links**
5. Click **Add requirement**
6. Select your application
7. Configure the requirement:
    - Field: "Is Assistant?"
    - Condition: "is equal to"
    - Value: ✅ (checked for true)

Now users who have `is_assistant: true` in the database and have connected via OAuth will automatically get this role!

## Database Options

### JSON (Default)

-   Simple file-based storage
-   Good for development and small deployments
-   Data stored in `./data` directory
-   No external dependencies

### MongoDB

-   Scalable cloud database
-   Good for production deployments
-   Supports multiple instances
-   Requires MongoDB connection string

## API Endpoints

### `POST /api/interactions`

Handles Discord interaction events (commands, buttons, etc.)

### `GET /api/discord-oauth-callback`

Handles OAuth2 callback from Discord after user authorization

## Troubleshooting

### "Failed to update Discord metadata"

-   Verify your `DISCORD_CLIENT_SECRET` is correct
-   Check that the redirect URI matches exactly in Discord Developer Portal
-   Ensure the user has authorized with `role_connections.write` scope

### "Database connection failed"

-   For JSON: Check that the `DATABASE_PATH` directory exists and is writable
-   For MongoDB: Verify your `MONGO_URI` is correct and the database is accessible

### "Commands not showing up"

-   Run `npm run register` to register commands with Discord
-   Wait a few minutes for Discord to propagate the commands
-   Try restarting your Discord client

## Security Notes

-   `COOKIE_SECRET` should be a long, random string
-   Never commit `.env` file to version control
-   Store sensitive credentials in Vercel environment variables
-   The OAuth callback validates all requests before processing

## File Structure

```
.
├── api/
│   ├── interactions.ts              # Main interaction handler
│   └── discord-oauth-callback.ts    # OAuth callback handler
├── src/
│   ├── commands/
│   │   ├── link_role.ts            # Generate OAuth link
│   │   ├── set_assistant.ts        # Set assistant status
│   │   └── view_assistant.ts       # View assistant status
│   └── utils/
│       └── database.ts             # Database utilities
└── .env                            # Environment variables (not in git)
```

## Additional Resources

-   [Discord Linked Roles Documentation](https://discord.com/developers/docs/tutorials/configuring-app-metadata-for-linked-roles)
-   [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
-   [mini-interaction Package](https://www.npmjs.com/package/@minesa-org/mini-interaction)

## Support

If you encounter any issues, please check:

1. All environment variables are set correctly
2. Commands are registered with Discord
3. OAuth redirect URI matches exactly
4. Database is accessible and writable
