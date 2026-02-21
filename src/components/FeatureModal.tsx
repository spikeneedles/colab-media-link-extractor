import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FeatureModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
}

export function FeatureModal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children
}: FeatureModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon && <div className="text-accent">{icon}</div>}
              <div>
                <DialogTitle className="text-xl">{title}</DialogTitle>
                {description && (
                  <DialogDescription className="mt-1">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X size={20} />
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          {children}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
