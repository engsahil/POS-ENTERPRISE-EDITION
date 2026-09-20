import { useNavigate } from 'react-router-dom';
import { EmptyState, Button } from '@/components/ui';
import { AlertIcon } from '@/components/ui/Icons';
import { ROUTE_PATHS } from '@/app/routes';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <EmptyState
        fill
        icon={<AlertIcon />}
        title="Page not found"
        description="The address you opened is not part of this application."
        action={
          <Button onClick={() => navigate(ROUTE_PATHS.pos)}>Back to POS</Button>
        }
      />
    </div>
  );
}
