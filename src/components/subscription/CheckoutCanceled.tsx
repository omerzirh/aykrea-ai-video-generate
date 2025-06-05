import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CheckoutCanceled() {
  const navigate = useNavigate();
console.log("CheckoutCanceled")
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl">Checkout Canceled</CardTitle>
          <CardDescription>
            Your subscription process was canceled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mt-1">
              You can try again whenever you're ready or continue with your current plan.
            </p>
          </div>
          <div className="flex justify-center space-x-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button onClick={() => navigate('/plans')}>
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
