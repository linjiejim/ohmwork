import * as React from "react"
import { Cloud, CloudOff, KeyRound, LogOut, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useProgress } from "@/curriculum/progress"
import { GitHubMark } from "./GitHubMark"
import {
  bindUsernamePassword,
  closeAuthDialogs,
  displayName,
  signOut,
  startGithubBind,
  syncNow,
  unlinkGithubAccount,
  updatePassword,
  useAuth,
} from "./store"

const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,23}$/

export function AccountDialog() {
  const auth = useAuth()
  const progress = useProgress()
  const open = auth.dialog === "account" && auth.user !== null
  const user = auth.user

  const [mode, setMode] = React.useState<"idle" | "bind-password" | "change-password" | "confirm-unbind">("idle")
  const [username, setUsername] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setMode("idle")
      setUsername("")
      setCurrentPassword("")
      setPassword("")
      setConfirm("")
      setError(null)
      setBusy(false)
    }
  }, [open])

  if (!user) return null

  const resetForm = () => {
    setMode("idle")
    setUsername("")
    setCurrentPassword("")
    setPassword("")
    setConfirm("")
    setError(null)
  }

  const handleBindGithub = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await startGithubBind()
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法发起 GitHub 绑定")
      setBusy(false)
    }
  }

  const handleUnbindGithub = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await unlinkGithubAccount()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "解绑失败，请稍后重试")
    } finally {
      setBusy(false)
    }
  }

  const handleBindPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const u = username.trim()
    if (!USERNAME_RE.test(u)) {
      setError("用户名需为 3–24 位字母、数字、下划线或连字符，且以字母或数字开头")
      return
    }
    if (password.length < 8) {
      setError("密码至少需要 8 位")
      return
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await bindUsernamePassword(u, password)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "绑定失败，请稍后重试")
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!currentPassword) {
      setError("请输入当前密码")
      return
    }
    if (password.length < 8) {
      setError("新密码至少需要 8 位")
      return
    }
    if (password !== confirm) {
      setError("两次输入的新密码不一致")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updatePassword(currentPassword, password)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改密码失败，请稍后重试")
    } finally {
      setBusy(false)
    }
  }

  const syncLabel =
    auth.syncState === "syncing"
      ? "正在同步…"
      : auth.syncState === "offline"
        ? "离线，联网后自动同步"
        : "已与云端同步"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeAuthDialogs()}>
      <DialogContent size="md">
        <DialogHeader title="账号与进度同步" description={`当前账号：${displayName(user)}`} />
        <DialogBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-sunken px-3.5 py-3">
            <div className="min-w-0">
              <div className="tabular text-body font-medium">
                已学 {progress.count} / {progress.total} 课
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-caption text-muted-foreground">
                {auth.syncState === "offline" ? (
                  <CloudOff className="size-3.5 text-warning" />
                ) : (
                  <Cloud className="size-3.5 text-success" />
                )}
                <span>{syncLabel}</span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={auth.syncState === "syncing"}
              onClick={() => void syncNow()}
            >
              <RefreshCw />
              立即同步
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-caption font-medium text-faint-foreground">登录方式与绑定</div>

            {/* GitHub binding row */}
            <div className="rounded-lg border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <GitHubMark className="size-4 shrink-0 text-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-body font-medium">
                      <span>GitHub</span>
                      {user.github ? (
                        <Badge tone="success">已绑定</Badge>
                      ) : (
                        <Badge tone="neutral">未绑定</Badge>
                      )}
                    </div>
                    <p className="truncate text-caption text-muted-foreground">
                      {user.github
                        ? `@${user.github.login}${user.github.name ? `（${user.github.name}）` : ""}`
                        : auth.githubEnabled
                          ? "绑定后可直接用 GitHub 一键登录同一份进度"
                          : "当前服务未启用 GitHub 登录"}
                    </p>
                  </div>
                </div>

                {user.github ? (
                  user.hasPassword ? (
                    mode === "confirm-unbind" ? (
                      <div className="flex items-center gap-1.5">
                        <Button type="button" size="sm" variant="destructive" loading={busy} onClick={handleUnbindGithub}>
                          确认解绑
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                          取消
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setError(null)
                          setMode("confirm-unbind")
                        }}
                      >
                        解绑 GitHub
                      </Button>
                    )
                  ) : (
                    <span className="text-caption text-faint-foreground">绑定密码后可解绑</span>
                  )
                ) : (
                  auth.githubEnabled && (
                    <Button type="button" size="sm" variant="secondary" loading={busy} onClick={handleBindGithub}>
                      绑定 GitHub
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Username + password row */}
            <div className="rounded-lg border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <KeyRound className="size-4 shrink-0 text-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-body font-medium">
                      <span>用户名和密码</span>
                      {user.hasPassword ? (
                        <Badge tone="success">已设置</Badge>
                      ) : (
                        <Badge tone="neutral">未设置</Badge>
                      )}
                    </div>
                    <p className="truncate text-caption text-muted-foreground">
                      {user.username
                        ? `用户名：${user.username}`
                        : "绑定后无需 GitHub 也能直接登录同步进度"}
                    </p>
                  </div>
                </div>

                {user.hasPassword ? (
                  mode !== "change-password" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setError(null)
                        setMode("change-password")
                      }}
                    >
                      修改密码
                    </Button>
                  )
                ) : (
                  mode !== "bind-password" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setError(null)
                        setMode("bind-password")
                      }}
                    >
                      绑定用户名和密码
                    </Button>
                  )
                )}
              </div>

              {mode === "bind-password" && (
                <form onSubmit={handleBindPassword} noValidate className="mt-4 border-t pt-4">
                  <FieldGroup>
                    <Field label="用户名" hint="3–24 位字母、数字、下划线或连字符">
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        placeholder={user.github?.login ?? "例如 alice_ee"}
                      />
                    </Field>
                    <Field label="密码" hint="至少 8 位">
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field label="确认密码">
                      <Input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                      />
                    </Field>
                  </FieldGroup>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                      取消
                    </Button>
                    <Button type="submit" size="sm" variant="primary" loading={busy}>
                      保存绑定
                    </Button>
                  </div>
                </form>
              )}

              {mode === "change-password" && (
                <form onSubmit={handleChangePassword} noValidate className="mt-4 border-t pt-4">
                  <FieldGroup>
                    <Field label="当前密码">
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </Field>
                    <Field label="新密码" hint="至少 8 位">
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field label="确认新密码">
                      <Input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                      />
                    </Field>
                  </FieldGroup>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                      取消
                    </Button>
                    <Button type="submit" size="sm" variant="primary" loading={busy}>
                      更新密码
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-small text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter className="border-t">
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            <LogOut />
            退出登录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
