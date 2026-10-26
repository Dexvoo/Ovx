// Type-only: what the dashboard stores in each login session (see src/dashboard/auth.js)
import 'express-session';

declare module 'express-session' {
    interface SessionData {
        user: { id: string; username: string; displayName: string; avatar: string | null };
        guilds: { id: string; name: string; icon: string | null }[];
        oauthState?: string;
        returnTo?: string;
    }
}
