export interface User {
  x_user_id: string;
  username: string;
  avatar: string | null;
  wallet_address: string | null;
  x_verified: number | null;
  /** mapped from x_verified in /api/auth/me (NULL = unverified) */
  xVerified: boolean;
  created_at: string;
}

export interface TaskDef {
  id: string;
  title: string;
  description: string;
  points: number;
  repeatability: "once" | "repeatable";
  dailyCap?: number;
  url?: string;
  completed: boolean;
  timesCompleted?: number;
  verified: boolean;
}

export interface Pin {
  id: number;
  lat: number;
  lng: number;
  city: string | null;
  epoch: string;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatar: string | null;
  points: number;
  me: boolean;
}

export interface ClaimableSeason {
  season: number;
  name: string;
  theme: string;
  description: string;
  status: "upcoming" | "active" | "claim-open" | "closed";
  startsAt: string;
  endsAt: string;
  claimWindowEndsAt: string;
  weekIds: string[];
  points: number;
  totalPoints: number;
  tokens: number;
  share: number;
  decimals: number;
  orvaPerSeason: number;
  alreadyClaimed: boolean;
  claimTxSig: string | null;
  claimExplorerUrl: string | null;
  claimWindowOpen: boolean;
}

export interface PointsMe {
  epoch: string;
  currentPoints: number;
  lifetime: number;
  claimableEpochs: string[];
}

export interface LinkedAccount {
  provider: "threads" | "instagram" | "facebook";
  username: string;
  linkedAt: string;
}
