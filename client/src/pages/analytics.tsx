import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Activity,
  Target,
  Heart,
  MessageSquare,
  UserPlus,
  Clock,
  Calendar,
  Zap
} from "lucide-react";

export default function Analytics() {
  const [, setLocation] = useLocation();
  const userToken = localStorage.getItem('xreplyguy_wallet');

  // Mock analytics data for demo
  const analyticsData = {
    totalActions: 1247,
    successRate: 94.2,
    avgResponseTime: 3.2,
    topKeywords: ['AI', 'startup', 'tech', 'innovation', 'growth'],
    dailyStats: [
      { date: '2025-06-23', likes: 15, replies: 8, follows: 3 },
      { date: '2025-06-24', likes: 22, replies: 12, follows: 5 },
      { date: '2025-06-25', likes: 18, replies: 10, follows: 2 },
      { date: '2025-06-26', likes: 25, replies: 15, follows: 6 },
      { date: '2025-06-27', likes: 20, replies: 11, follows: 4 },
      { date: '2025-06-28', likes: 28, replies: 18, follows: 7 },
      { date: '2025-06-29', likes: 32, replies: 22, follows: 9 },
    ]
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="flex items-center space-x-4 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/dashboard")}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-gray-400 text-sm">Performance insights and automation metrics</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Total Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.totalActions.toLocaleString()}</div>
              <p className="text-xs text-green-400">+12% from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{analyticsData.successRate}%</div>
              <p className="text-xs text-green-400">+2.1% from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{analyticsData.avgResponseTime}s</div>
              <p className="text-xs text-green-400">-0.5s from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Active Automations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">3</div>
              <p className="text-xs text-gray-500">currently running</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Weekly Activity
              </CardTitle>
              <CardDescription>
                Actions performed over the last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.dailyStats.map((day, index) => {
                  const total = day.likes + day.replies + day.follows;
                  const maxTotal = Math.max(...analyticsData.dailyStats.map(d => d.likes + d.replies + d.follows));
                  const percentage = (total / maxTotal) * 100;
                  
                  return (
                    <div key={day.date} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="font-medium">{total} actions</span>
                      </div>
                      <div className="w-full bg-[hsl(0,0%,15%)] rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-[hsl(263,70%,50%)] to-[hsl(187,100%,42%)] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Heart className="h-3 w-3 mr-1 text-red-400" />
                          {day.likes}
                        </span>
                        <span className="flex items-center">
                          <MessageSquare className="h-3 w-3 mr-1 text-blue-400" />
                          {day.replies}
                        </span>
                        <span className="flex items-center">
                          <UserPlus className="h-3 w-3 mr-1 text-green-400" />
                          {day.follows}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Top Keywords
              </CardTitle>
              <CardDescription>
                Most effective keywords this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.topKeywords.map((keyword, index) => {
                  const percentage = Math.max(85 - index * 10, 60); // Mock percentages
                  return (
                    <div key={keyword} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-300">#{keyword}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-[hsl(0,0%,15%)] rounded-full h-1.5">
                          <div
                            className="bg-[hsl(263,70%,50%)] h-1.5 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Action Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Heart className="h-4 w-4 text-red-400" />
                    <span className="text-sm">Likes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-[hsl(0,0%,15%)] rounded-full h-2">
                      <div className="bg-red-400 h-2 rounded-full" style={{ width: '65%' }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8">65%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    <span className="text-sm">Replies</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-[hsl(0,0%,15%)] rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: '25%' }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8">25%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="h-4 w-4 text-green-400" />
                    <span className="text-sm">Follows</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-[hsl(0,0%,15%)] rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full" style={{ width: '10%' }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8">10%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Peak Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-400">2:00 PM - 4:00 PM</div>
                  <p className="text-xs text-gray-500">Most active period</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-400">94.7%</div>
                  <p className="text-xs text-gray-500">Peak success rate</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-purple-400">18.3</div>
                  <p className="text-xs text-gray-500">Avg actions/hour</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Growth Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-400">+127%</div>
                  <p className="text-xs text-gray-500">Engagement growth</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-400">+89%</div>
                  <p className="text-xs text-gray-500">Reply quality</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-purple-400">+203%</div>
                  <p className="text-xs text-gray-500">Reach expansion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Health */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
              Account Health Monitor
            </CardTitle>
            <CardDescription>
              Real-time monitoring of automation safety and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-green-400">A+</span>
                </div>
                <h4 className="font-medium mb-1">Stealth Rating</h4>
                <p className="text-xs text-gray-500">Excellent detection avoidance</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-blue-400">98%</span>
                </div>
                <h4 className="font-medium mb-1">Account Safety</h4>
                <p className="text-xs text-gray-500">No suspension risks detected</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-purple-400">5.2K</span>
                </div>
                <h4 className="font-medium mb-1">Quality Score</h4>
                <p className="text-xs text-gray-500">High-value interactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}