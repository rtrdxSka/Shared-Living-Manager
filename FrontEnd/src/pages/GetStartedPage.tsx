import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, Info } from 'lucide-react';

export default function GetStartedPage() {
  const { user } = useAuth();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
      <Card className="relative w-full max-w-lg rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-4 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome, {user?.firstName}!
            </CardTitle>
            <CardDescription className="text-base">
              Let's get you set up
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-6 px-6 pb-8 pt-4 sm:px-8">
          <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4 text-left">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              This page will contain the choice between "Create household" and
              "Join household" with an onboarding survey. It is pending in the next step.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}