import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, Code2, Clock, CheckCircle, XCircle, Loader, LogOut } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../lib/AuthContext";

const STATUS_CONFIG = {
  PENDING: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10", label: "Pending" },
  PROCESSING: { icon: Loader, color: "text-blue-400", bg: "bg-blue-400/10", label: "Processing" },
  COMPLETED: { icon: CheckCircle, color: "text-brand-500", bg: "bg-brand-500/10", label: "Completed" },
  FAILED: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", label: "Failed" },
};

const ReviewCard = ({ review }) => {
  const cfg = STATUS_CONFIG[review.status] || STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/review/${review.id}`)}
      className="card cursor-pointer hover:border-[#45475a] transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[#cdd6f4] truncate group-hover:text-white">
            {review.title}
          </h3>
          <p className="text-xs text-[#6c7086] mt-1">
            {review.language} · {new Date(review.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}>
          <Icon className={`w-3 h-3 ${review.status === "PROCESSING" ? "animate-spin" : ""}`} />
          {cfg.label}
        </span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchReviews = async () => {
    try {
      const { data } = await api.get("/reviews");
      setReviews(data.reviews);
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    // Poll for status updates every 5s
    const interval = setInterval(fetchReviews, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="border-b border-[#313244] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-brand-500" />
          <span className="font-bold">Kritique</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#6c7086]">{user?.name}</span>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Reviews</h1>
            <p className="text-sm text-[#6c7086] mt-1">
              AI-powered code review history
            </p>
          </div>
          <Link to="/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Review
          </Link>
        </div>

        {/* Reviews list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 animate-spin text-[#6c7086]" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="card text-center py-16">
            <Code2 className="w-10 h-10 text-[#313244] mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
            <p className="text-sm text-[#6c7086] mb-6">
              Submit your first code snippet for an AI review
            </p>
            <Link to="/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Submit Code
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
