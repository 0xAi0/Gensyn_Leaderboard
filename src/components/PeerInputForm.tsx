"use client";

import type * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  peerName: z.string().min(1, 'Peer identifier cannot be empty.'),
  gpu: z.string().optional(), // GPU field is optional
});

interface PeerInputFormProps {
  onAddPeer: (name: string, gpu?: string) => Promise<void>;
  isAdding: boolean;
}

export function PeerInputForm({ onAddPeer, isAdding }: PeerInputFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      peerName: '',
      gpu: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await onAddPeer(values.peerName, values.gpu);
      form.reset();
    } catch (error) {
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
        <FormField
          control={form.control}
          name="gpu"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GPU (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., RTX 4090, A100" {...field} />
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
