'use client';

// Model Storage Manager Component
// Provides UI for managing model storage, versions, sharing, and exports

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Download, 
  Share2, 
  Trash2, 
  Clock, 
  HardDrive, 
  FileText, 
  ExternalLink,
  Copy,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from './ui/use-toast';

interface ModelWeight {
  id: string;
  model_id: number;
  version: number;
  file_path: string;
  file_size: number;
  file_hash: string;
  storage_provider: string;
  metadata: any;
  training_config: any;
  quality_metrics: any;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
}

interface ModelShare {
  id: string;
  model_id: number;
  share_token: string;
  access_level: 'view' | 'download' | 'clone';
  expires_at?: string;
  download_count: number;
  max_downloads?: number;
  is_public: boolean;
  created_at: string;
}

interface ModelExport {
  id: string;
  model_id: number;
  export_format: string;
  export_status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  download_url?: string;
  file_size?: number;
  expires_at: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface StorageStats {
  total_models: number;
  total_storage_bytes: number;
  active_versions: number;
  expired_models: number;
  shared_models: number;
  public_models: number;
  cleanup_operations: number;
  average_model_size: number;
}

interface ModelStorageManagerProps {
  modelId: number;
  userId: string;
  onStorageUpdate?: () => void;
}

export default function ModelStorageManager({ modelId, userId, onStorageUpdate }: ModelStorageManagerProps) {
  const [versions, setVersions] = useState<ModelWeight[]>([]);
  const [shares, setShares] = useState<ModelShare[]>([]);
  const [exports, setExports] = useState<ModelExport[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('versions');

  // Dialog states
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  // Form states
  const [shareForm, setShareForm] = useState({
    access_level: 'view' as 'view' | 'download' | 'clone',
    expires_at: '',
    max_downloads: '',
    is_public: false
  });

  const [exportForm, setExportForm] = useState({
    export_format: 'safetensors' as 'safetensors' | 'pytorch' | 'onnx' | 'zip'
  });

  useEffect(() => {
    loadData();
  }, [modelId, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadVersions(),
        loadShares(),
        loadExports(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load model storage data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    const response = await fetch(`/api/models/storage?modelId=${modelId}`);
    const data = await response.json();
    if (data.success) {
      setVersions(data.data.versions || []);
    }
  };

  const loadShares = async () => {
    // This would need a separate endpoint to get shares for a model
    // For now, we'll use a placeholder
    setShares([]);
  };

  const loadExports = async () => {
    const response = await fetch(`/api/models/export?userId=${userId}`);
    const data = await response.json();
    if (data.success) {
      setExports(data.data.filter((exp: ModelExport) => exp.model_id === modelId));
    }
  };

  const loadStats = async () => {
    const response = await fetch(`/api/models/storage?userId=${userId}`);
    const data = await response.json();
    if (data.success) {
      setStats(data.data);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm('Are you sure you want to delete this model version? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/models/storage?weightId=${versionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Model version deleted successfully'
        });
        loadVersions();
        loadStats();
        onStorageUpdate?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to delete model version: ${error}`,
        variant: 'destructive'
      });
    }
  };

  const handleCreateShare = async () => {
    try {
      const response = await fetch('/api/models/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: modelId,
          ...shareForm,
          max_downloads: shareForm.max_downloads ? parseInt(shareForm.max_downloads) : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Model share created successfully'
        });
        setShareDialogOpen(false);
        loadShares();
        
        // Copy share URL to clipboard
        const shareUrl = `${window.location.origin}/models/shared/${data.data.share_token}`;
        navigator.clipboard.writeText(shareUrl);
        toast({
          title: 'Share URL copied',
          description: 'The share URL has been copied to your clipboard'
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to create share: ${error}`,
        variant: 'destructive'
      });
    }
  };

  const handleCreateExport = async () => {
    try {
      const response = await fetch('/api/models/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: modelId,
          ...exportForm
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Export request created successfully'
        });
        setExportDialogOpen(false);
        loadExports();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to create export: ${error}`,
        variant: 'destructive'
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading storage data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Storage Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total_models}</div>
                <div className="text-sm text-muted-foreground">Total Models</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatFileSize(stats.total_storage_bytes)}</div>
                <div className="text-sm text-muted-foreground">Storage Used</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.active_versions}</div>
                <div className="text-sm text-muted-foreground">Active Versions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.shared_models}</div>
                <div className="text-sm text-muted-foreground">Shared Models</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="shares">Sharing</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        {/* Versions Tab */}
        <TabsContent value="versions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Model Versions</h3>
          </div>

          <div className="space-y-3">
            {versions.map((version) => (
              <Card key={version.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={version.is_active ? 'default' : 'secondary'}>
                        v{version.version} {version.is_active && '(Active)'}
                      </Badge>
                      <div>
                        <div className="font-medium">
                          {formatFileSize(version.file_size)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created {formatDate(version.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {version.expires_at && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Expires {formatDate(version.expires_at)}
                        </div>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteVersion(version.id)}
                        disabled={version.is_active}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {version.quality_metrics && Object.keys(version.quality_metrics).length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm font-medium mb-2">Quality Metrics</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {version.quality_metrics.clip_similarity_score && (
                          <div>
                            <span className="text-muted-foreground">CLIP:</span>{' '}
                            {(version.quality_metrics.clip_similarity_score * 100).toFixed(1)}%
                          </div>
                        )}
                        {version.quality_metrics.face_recognition_accuracy && (
                          <div>
                            <span className="text-muted-foreground">Face:</span>{' '}
                            {(version.quality_metrics.face_recognition_accuracy * 100).toFixed(1)}%
                          </div>
                        )}
                        {version.quality_metrics.user_rating && (
                          <div>
                            <span className="text-muted-foreground">Rating:</span>{' '}
                            {version.quality_metrics.user_rating}/5
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {versions.length === 0 && (
              <Card>
                <CardContent className="text-center p-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No model versions found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Sharing Tab */}
        <TabsContent value="shares" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Model Sharing</h3>
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Share2 className="h-4 w-4 mr-2" />
                  Create Share
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Model</DialogTitle>
                  <DialogDescription>
                    Create a shareable link for this model
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="access_level">Access Level</Label>
                    <Select
                      value={shareForm.access_level}
                      onValueChange={(value: 'view' | 'download' | 'clone') => 
                        setShareForm({ ...shareForm, access_level: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">View Only</SelectItem>
                        <SelectItem value="download">Download</SelectItem>
                        <SelectItem value="clone">Clone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      value={shareForm.expires_at}
                      onChange={(e) => setShareForm({ ...shareForm, expires_at: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="max_downloads">Max Downloads (Optional)</Label>
                    <Input
                      id="max_downloads"
                      type="number"
                      placeholder="Unlimited"
                      value={shareForm.max_downloads}
                      onChange={(e) => setShareForm({ ...shareForm, max_downloads: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_public"
                      checked={shareForm.is_public}
                      onCheckedChange={(checked) => setShareForm({ ...shareForm, is_public: checked })}
                    />
                    <Label htmlFor="is_public">Make public</Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateShare}>
                      Create Share
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {shares.map((share) => (
              <Card key={share.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge>{share.access_level}</Badge>
                        {share.is_public && <Badge variant="secondary">Public</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Downloads: {share.download_count}
                        {share.max_downloads && ` / ${share.max_downloads}`}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/models/shared/${share.share_token}`;
                          navigator.clipboard.writeText(shareUrl);
                          toast({ title: 'Share URL copied to clipboard' });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/models/shared/${share.share_token}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {shares.length === 0 && (
              <Card>
                <CardContent className="text-center p-8">
                  <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No shares created yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Exports Tab */}
        <TabsContent value="exports" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Model Exports</h3>
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Create Export
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Model</DialogTitle>
                  <DialogDescription>
                    Create a downloadable export of this model
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="export_format">Export Format</Label>
                    <Select
                      value={exportForm.export_format}
                      onValueChange={(value: 'safetensors' | 'pytorch' | 'onnx' | 'zip') => 
                        setExportForm({ ...exportForm, export_format: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="safetensors">SafeTensors</SelectItem>
                        <SelectItem value="pytorch">PyTorch</SelectItem>
                        <SelectItem value="onnx">ONNX</SelectItem>
                        <SelectItem value="zip">ZIP Archive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateExport}>
                      Create Export
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {exports.map((exportRecord) => (
              <Card key={exportRecord.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(exportRecord.export_status)}
                      <div>
                        <div className="font-medium">
                          {exportRecord.export_format.toUpperCase()} Export
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created {formatDate(exportRecord.created_at)}
                          {exportRecord.file_size && ` • ${formatFileSize(exportRecord.file_size)}`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        exportRecord.export_status === 'completed' ? 'default' :
                        exportRecord.export_status === 'failed' ? 'destructive' :
                        'secondary'
                      }>
                        {exportRecord.export_status}
                      </Badge>
                      
                      {exportRecord.export_status === 'completed' && exportRecord.download_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(exportRecord.download_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {exportRecord.error_message && (
                    <Alert className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{exportRecord.error_message}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}

            {exports.length === 0 && (
              <Card>
                <CardContent className="text-center p-8">
                  <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No exports created yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}