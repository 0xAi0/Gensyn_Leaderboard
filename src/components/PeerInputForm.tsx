"use client";

import type * as React from 'react';
// import { useState } from 'react'; // No longer needed with RHF managing state
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
// import { useToast } from "@/hooks/use-toast"; // Toast handled by parent


const formSchema = z.object({
  peerName: z.string().min(1, 'Peer identifier cannot be empty.'),
});

interface PeerInputFormProps {
  onAddPeer: (name: string) => Promise<void>;
  isAdding: boolean;
}

export function PeerInputForm({ onAddPeer, isAdding }: PeerInputFormProps) {
  // const { toast } = useToast(); // Toast handled by parent
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      peerName: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await onAddPeer(values.peerName);
      form.reset();
    } catch (error) {
      // Error is handled by the parent component's onAddPeer which should show a toast
      console.error("Error in PeerInputForm onSubmit:", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-8 p-6 bg-card shadow-lg rounded-lg">
        <FormField
          control={form.control}
          name="peerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Peer Identifier</FormLabel>
              <FormControl>
                <Input placeholder="Enter peer identifier (e.g., wdkfd)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isAdding} className="w-full sm:w-auto">
          {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add Peer
        </Button>
      </form>
    </Form>
  );
}
