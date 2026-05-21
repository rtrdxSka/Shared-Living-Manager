import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IssuesTab } from '@/components/dashboard/roommates/IssuesTab';
import { VotesTab } from '@/components/dashboard/roommates/VotesTab';
import { RulesTab } from '@/components/dashboard/roommates/RulesTab';

export default function HouseRulesPage() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">House Rules</h1>
        <p className="text-sm text-muted-foreground">
          Raise issues, vote on proposals, and see what's been agreed.
        </p>
      </header>
      <Tabs defaultValue="issues" className="w-full">
        <TabsList>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="votes">Active Votes</TabsTrigger>
          <TabsTrigger value="rules">Passed Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="issues">
          <IssuesTab />
        </TabsContent>
        <TabsContent value="votes">
          <VotesTab />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
