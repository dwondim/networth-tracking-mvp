import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Plus, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AmexConnection } from '@/components/integrations/AmexConnection';

interface NetWorthData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  isAsset: boolean;
  provider?: string;
  lastUpdated: Date;
}

export function NetWorthDashboard() {
  const { user, signOut } = useAuth();
  const [netWorthData, setNetWorthData] = useState<NetWorthData>({
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userProfile, setUserProfile] = useState<{ first_name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAmexConnection, setShowAmexConnection] = useState(false);
  const { toast } = useToast();

  const fetchNetWorthData = async () => {
    try {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view your net worth.",
          variant: "destructive"
        });
        return;
      }

      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single();

      if (!profileError && profileData) {
        setUserProfile(profileData);
      }

      // Get net worth calculation
      const { data: netWorthResult, error: netWorthError } = await supabase
        .rpc('calculate_net_worth', { user_uuid: user.id });

      if (netWorthError) throw netWorthError;

      if (netWorthResult && netWorthResult.length > 0) {
        const result = netWorthResult[0];
        setNetWorthData({
          totalAssets: Number(result.total_assets) || 0,
          totalLiabilities: Number(result.total_liabilities) || 0,
          netWorth: Number(result.net_worth) || 0
        });
      }

      // Get accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (accountsError) throw accountsError;

      setAccounts(accountsData.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: account.current_balance,
        isAsset: account.is_asset,
        provider: account.provider,
        lastUpdated: new Date(account.updated_at)
      })));

    } catch (error) {
      console.error('Error fetching net worth data:', error);
      toast({
        title: "Error",
        description: "Failed to load financial data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchNetWorthData();
  };

  const handleAmexConnectionSuccess = () => {
    setShowAmexConnection(false);
    fetchNetWorthData();
    toast({
      title: "Success",
      description: "American Express accounts connected successfully!",
    });
  };

  useEffect(() => {
    fetchNetWorthData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getNetWorthTrend = () => {
    if (netWorthData.netWorth > 0) {
      return { icon: TrendingUp, color: 'text-success', text: 'Positive' };
    } else if (netWorthData.netWorth < 0) {
      return { icon: TrendingDown, color: 'text-destructive', text: 'Negative' };
    } else {
      return { icon: DollarSign, color: 'text-muted-foreground', text: 'Neutral' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const trend = getNetWorthTrend();
  const TrendIcon = trend.icon;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Net Worth Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {userProfile?.first_name || user?.email?.split('@')[0] || 'there'}!
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={signOut}
            variant="outline"
            size="sm"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Net Worth Overview */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(netWorthData.totalAssets)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(netWorthData.totalLiabilities)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <TrendIcon className={`h-4 w-4 ${trend.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${trend.color}`}>
              {formatCurrency(netWorthData.netWorth)}
            </div>
            <p className="text-xs text-muted-foreground">
              {trend.text} net worth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Assets
            </CardTitle>
            <CardDescription>Your positive financial holdings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.filter(account => account.isAsset).length > 0 ? (
                accounts.filter(account => account.isAsset).map(account => (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-muted-foreground">{account.type}</p>
                      {account.provider && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {account.provider}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-success">
                        {formatCurrency(account.balance)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated: {account.lastUpdated.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-6">
                  No assets added yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-destructive" />
              Liabilities
            </CardTitle>
            <CardDescription>Your debts and obligations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.filter(account => !account.isAsset).length > 0 ? (
                accounts.filter(account => !account.isAsset).map(account => (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-muted-foreground">{account.type}</p>
                      {account.provider && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {account.provider}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-destructive">
                        {formatCurrency(Math.abs(account.balance))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated: {account.lastUpdated.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-6">
                  No liabilities added yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Account Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Button 
          onClick={() => setShowAmexConnection(true)}
          className="flex items-center gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Connect American Express
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Manual Account
        </Button>
      </div>

      {/* Amex Connection Modal/Dialog */}
      {showAmexConnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Connect American Express</h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAmexConnection(false)}
              >
                ×
              </Button>
            </div>
            <AmexConnection onConnectionSuccess={handleAmexConnectionSuccess} />
          </div>
        </div>
      )}
    </div>
  );
}