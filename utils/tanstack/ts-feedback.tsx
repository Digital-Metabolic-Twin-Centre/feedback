"use client";

/**
 * Use for the evaluation committee to provide feedback on suspected cases. 
 */

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { secureFetch } from "@/hooks/secure-fetch";
import { API_ENDPOINTS } from "@/lib/urls";

interface FeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;

    title: string;
    schema: string;
    tableName: string;

    /** extra payload passed by caller */
    data?: Record<string, unknown>;

    placeholder?: string;

    onSuccess?: () => void;
}

export default function FeedbackDialog({
    open,
    onOpenChange,
    title,
    schema,
    tableName,
    data = {},
    placeholder = "Enter message...",
    onSuccess,
}: FeedbackDialogProps) {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setMessage(String(data?.committee_review ?? ""));
        }
    }, [open, data]);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const committee_review = message.trim();

            const res = await secureFetch(API_ENDPOINTS.UPDATE, {
                method: "POST",
                body: JSON.stringify({
                    schema,
                    tableName,
                    updates: {
                        committee_review,
                        id: data.suspected_case_id,
                    },
                }),
            });

            const json = await res.json();
  
            if (!json.success) {
                toast.error(json.message);
                return;
            }

            toast.success("Submitted successfully");

            setMessage("");
            onOpenChange(false);

            onSuccess?.();
        } catch (err) {
            console.error(err);
            toast.error("Submission failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-lg"
                onEscapeKeyDown={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription/>
                </DialogHeader>

                <Textarea
                    placeholder={placeholder}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[120px]"
                />

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>

                    <Button
                        onClick={handleSubmit}
                        disabled={!message.trim() || loading}
                    >
                        {loading ? "Submitting..." : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}