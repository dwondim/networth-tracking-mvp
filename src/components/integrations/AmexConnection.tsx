import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AmexConnectionProps {
  onConnectionSuccess?: () => void;
}

type ConnectionMethod = 'plaid' | 'direct' | 'manual';

export function AmexConnection({ onConnectionSuccess }: AmexConnectionProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('plaid');
  const { toast } = useToast();

  const handlePlaidConnection = async () => {
    setIsConnecting(true);
    try {
      // TODO: Implement Plaid Link integration
      toast({
        title: "Plaid Integration",
        description: "Plaid Link integration will be implemented next.",
      });
    } catch (error) {
      console.error('Plaid connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Unable to connect via Plaid. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDirectConnection = async () => {
    setIsConnecting(true);
    try {
      toast({
        title: "Direct API",
        description: "Direct Amex API integration requires business partnership.",
      });
    } catch (error) {
      console.error('Direct connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Direct connection unavailable. Please use Plaid integration.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualEntry = async () => {
    // TODO: Navigate to manual entry form
    toast({
      title: "Manual Entry",
      description: "Manual account entry form will be implemented.",
    });
    onConnectionSuccess?.();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <CardTitle>Connect American Express</CardTitle>
        </div>
        <CardDescription>
          Choose how you'd like to connect your Amex accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Method Selection */}
        <div className="space-y-3">
          <Button
            variant={connectionMethod === 'plaid' ? 'default' : 'outline'}
            className="w-full justify-between"
            onClick={() => setConnectionMethod('plaid')}
          >
            <span>Plaid Integration</span>
            <Badge variant="secondary">Recommended</Badge>
          </Button>

          <Button
            variant={connectionMethod === 'direct' ? 'default' : 'outline'}
            className="w-full justify-between"
            onClick={() => setConnectionMethod('direct')}
            disabled
          >
            <span>Direct API</span>
            <Badge variant="outline">Coming Soon</Badge>
          </Button>

          <Button
            variant={connectionMethod === 'manual' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => setConnectionMethod('manual')}
          >
            Manual Entry
          </Button>
        </div>

        {/* Connection Action */}
        <div className="pt-4">
          {connectionMethod === 'plaid' && (
            <Button
              onClick={handlePlaidConnection}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Connect with Plaid
                </>
              )}
            </Button>
          )}

          {connectionMethod === 'direct' && (
            <div className="text-sm text-muted-foreground p-4 bg-muted rounded-md">
              Direct Amex API access requires business partnership and regulatory compliance.
              Use Plaid integration for immediate access.
            </div>
          )}

          {connectionMethod === 'manual' && (
            <Button onClick={handleManualEntry} className="w-full">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Enter Account Manually
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}