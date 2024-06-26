<svelte:options tag="tf-vm" />

<script lang="ts">
  import AddBtn from "../../components/AddBtn.svelte";
  import Alert from "../../components/Alert.svelte";
  import DeleteBtn from "../../components/DeleteBtn.svelte";
  import DeployBtn from "../../components/DeployBtn.svelte";
  import Modal from "../../components/DeploymentModal.svelte";
  import Input from "../../components/Input.svelte";
  import RootFsSize from "../../components/RootFsSize.svelte";
  import SelectNodeId from "../../components/SelectNodeId.svelte";
  // Components
  import SelectProfile from "../../components/SelectProfile.svelte";
  import Tabs from "../../components/Tabs.svelte";
  import type { IFlist, IFormField, ITab } from "../../types";
  import type { IProfile } from "../../types/Profile";
  import VM, { Disk, Env } from "../../types/vm";
  import deployVM from "../../utils/deployVM";
  import { display } from "../../utils/display";
  import getWireguardConfig from "../../utils/getWireguardConfig";
  import hasEnoughBalance from "../../utils/hasEnoughBalance";
  import isInvalidFlist from "../../utils/isInvalidFlist";
  import { noActiveProfile } from "../../utils/message";
  import normalizeDeploymentErrorMessage from "../../utils/normalizeDeploymentErrorMessage";
  import validateName, {
    isInvalid,
    validateCpu,
    validateEntryPoint,
    validateFlistvalue,
    validateKey,
    validateKeyValue,
    validateMemory,
    validatePrivateIPRange,
  } from "../../utils/validateName";

  const tabs: ITab[] = [
    { label: "Config", value: "config" },
    { label: "Environment Variables", value: "env" },
    { label: "Disks", value: "disks" },
    // { label: "Advanced", value: "advanced" },
  ];

  const data = new VM();

  // prettier-ignore
  const baseFields: IFormField[] = [
    { label: "CPU (vCores)", symbol: 'cpu', placeholder: 'CPU vCores', type: 'number', validator: validateCpu, invalid: false},
    { label: "Memory (MB)", symbol: 'memory', placeholder: 'Your Memory in MB', type: 'number', validator: validateMemory, invalid: false },
    { label: "Public IPv4", symbol: "publicIp", placeholder: "", type: 'checkbox' },
    { label: "Public IPv6", symbol: "publicIp6", placeholder: "", type: 'checkbox' },
    { label: "Planetary Network", symbol: "planetary", placeholder: "", type: 'checkbox' },
    { label: "Add Wireguard Access", symbol: "wireguard", placeholder: "", type: 'checkbox' },
  ];

  const nameField: IFormField = { label: "Name", placeholder: "Virtual Machine Name", symbol: "name", type: "text", validator: validateName, invalid: false }; // prettier-ignore

  // prettier-ignore
  const networkFields: IFormField[] = [
    { label: "Network Name", symbol: "name", placeholder: "Network Name", type: "text", validator: validateName , invalid: false},
    { label: "Network IP Range", symbol: "ipRange", placeholder: "xxx.xxx.0.0/16", type: "text", validator: validatePrivateIPRange, invalid: false },
  ];

  // prettier-ignore
  const flists: IFlist[] = [
    { name: "Ubuntu-22.04", url: "https://hub.grid.tf/tf-official-apps/threefoldtech-ubuntu-22.04.flist", entryPoint: "/sbin/zinit init" },
    { name: "Alpine", url: "https://hub.grid.tf/tf-official-apps/threefoldtech-alpine-3.flist", entryPoint: "/entrypoint.sh" },
    { name: "CentOS", url: "https://hub.grid.tf/tf-official-apps/threefoldtech-centos-8.flist", entryPoint: "/entrypoint.sh" },
    { name: "Nixos", url: "https://hub.grid.tf/tf-official-vms/nixos-micro-latest.flist", entryPoint: "/entrypoint.sh" }

  ];

  // prettier-ignore
  const flistField: IFormField = {
    label: "VM Image",
    symbol: "flist",
    type: "select",
    options: [
      { label: "Ubuntu-22.04", value: "0", selected: true },
      { label: "Alpine-3", value: "1" },
      { label: "CentOS-8", value: "2" },
      { label: "Nixos", value: "3" },
      { label: "Other", value: "other" }
    ]
  };
  let selectedFlist = 0;
  let flistSelectValue = "0";
  $: {
    const option = flistField.options[selectedFlist];
    if (option.value !== "other") {
      const flist = flists[selectedFlist];
      data.flist = flist?.url;
      data.entrypoint = flist?.entryPoint;
    }
  }

  // prettier-ignore
  const envFields: IFormField[] = [
    { label: 'Key', symbol: 'key', placeholder: "Environment Key", type: "text", validator: validateKey, invalid:false},
    { label: 'Value', symbol: 'value', placeholder: "Environment Value", validator: validateKeyValue,type: "text" },
  ];

  const deploymentStore = window.configs?.deploymentStore;
  let active = "config";
  let loading = false;
  let success = false;
  let failed = false;
  let profile: IProfile;
  let message: string;
  let modalData: Record<string, unknown>;
  let status: "valid" | "invalid";

  function _isInvalidDisks() {
    const mounts = data.disks.map(({ mountpoint }) => mountpoint.replaceAll("/", "")); // prettier-ignore
    const mountSet = new Set(mounts);

    const names = data.disks.map(({ name }) => name.trim());
    const nameSet = new Set(names);
    return mounts.length !== mountSet.size || names.length !== nameSet.size;
  }

  $: disabled = ((loading || !data.valid) && !(success || failed)) || !profile || status !== "valid" || validateFlist.invalid || nameField.invalid || isInvalid([...baseFields,...envFields, ...networkFields]) || _isInvalidDisks(); // prettier-ignore
  const currentDeployment = window.configs?.currentDeploymentStore;
  const validateFlist = {
    loading: false,
    error: null,
    validator: validateFlistvalue,
    invalid: false,
  };

  async function onDeployVM() {
    if (flistSelectValue === "other") {
      validateFlist.loading = true;
      validateFlist.error = null;

      if (await isInvalidFlist(data.flist)) {
        validateFlist.loading = false;
        validateFlist.error = "Invalid Flist URL.";
        return;
      }
    }

    loading = true;

    if (!hasEnoughBalance()) {
      failed = true;
      loading = false;
      message = "No enough balance to execute transaction requires 2 TFT at least in your wallet.";
      return;
    }

    success = false;
    failed = false;
    message = undefined;

    deployVM(data, profile, "VM")
      .then(async data => {
        deploymentStore.set(0);
        success = true;
        const wireguard = await getWireguardConfig({ name: data.interfaces[0].network });
        if (wireguard) {
          data.wireguard = wireguard[0];
        }
        modalData = data;
      })
      .catch((err: string) => {
        failed = true;
        message = normalizeDeploymentErrorMessage(err, "VM");
      })
      .finally(() => {
        validateFlist.loading = false;
        loading = false;
      });
  }

  function validateMountPoint({ id, mountpoint }: Disk) {
    const disks = data.disks;
    const valid = disks.reduce((v, disk) => {
      if (disk.id === id) return v;
      return v && disk.mountpoint.replaceAll("/", "") !== mountpoint.replaceAll("/", ""); // prettier-ignore
    }, true);
    return valid ? null : "Disks can't have duplicated mountpoint.";
  }

  function validateDiskName({ id, name }: Disk) {
    if (!name) return "Disk name is required";
    const valid = data.disks.reduce((v, disk) => {
      if (disk.id === id) return v;
      return v && disk.name.trim() !== name.trim();
    }, true);
    return valid ? null : "Disks can't have duplicated name.";
  }

  $: logs = $currentDeployment;

  $: showLogs = loading || (logs !== null && logs.type === "VM");
  $: showNoProfile = !showLogs && !profile;
  $: showSuccess = !showLogs && !showNoProfile && success;
  $: showFailed = !showLogs && !showNoProfile && failed;
  $: showContent = !showLogs && !showNoProfile && !showSuccess && !showFailed;
</script>

<SelectProfile
  on:profile={({ detail }) => {
    profile = detail;
    if (detail) {
      data.envs[0] = new Env(undefined, "SSH_KEY", detail?.sshKey);
    }
  }}
/>

<div style="padding: 15px;">
  <form on:submit|preventDefault={onDeployVM} class="box">
    <h4 class="is-size-4">Deploy a Micro Virtual Machine</h4>
    <p>
      Deploy a new micro virtual machine on the Threefold Grid
      <a target="_blank" href="https://library.threefold.me/info/manual/#/manual__weblets_vm">
        Quick start documentation</a
      >
    </p>
    <hr />

    <div style:display={showLogs ? "block" : "none"}>
      <Alert type="info" message={logs?.message ?? "Loading..."} />
    </div>

    <div style:display={showNoProfile ? "block" : "none"}>
      <Alert type="info" message={noActiveProfile} />
    </div>

    <div style:display={showSuccess ? "block" : "none"}>
      <Alert type="success" message="Successfully Deployed Vm." deployed={true} />
    </div>

    <div style:display={showFailed ? "block" : "none"}>
      <Alert type="danger" {message} />
    </div>

    <div style:display={showContent ? "block" : "none"}>
      <Tabs bind:active {tabs} />

      <section style={display(active, "config")}>
        <Input bind:data={data.name} bind:invalid={nameField.invalid} field={nameField} />

        <Input
          bind:data={flistSelectValue}
          bind:selected={selectedFlist}
          field={flistField}
          on:input={() => {
            validateFlist.error = null;
          }}
        />

        {#if flistSelectValue === "other"}
          <Input
            bind:data={data.flist}
            field={{
              label: "FList",
              symbol: "flist",
              placeholder: "VM Image",
              type: "text",
              ...validateFlist,
            }}
            on:input={() => {
              validateFlist.error = null;
            }}
          />

          <Input
            bind:data={data.entrypoint}
            field={{
              label: "Entry Point",
              symbol: "entrypoint",
              validator: validateEntryPoint,
              placeholder: "Entrypoint",
              type: "text",
            }}
          />
        {/if}

        <RootFsSize
          rootFs={data.rootFs}
          editable={data.rootFsEditable}
          cpu={data.cpu}
          memory={data.memory}
          on:update={({ detail }) => (data.rootFs = detail)}
          on:editableUpdate={({ detail }) => (data.rootFsEditable = detail)}
        />

        {#each baseFields as field (field.symbol)}
          {#if field.invalid !== undefined}
            <Input bind:data={data[field.symbol]} bind:invalid={field.invalid} {field} />
          {:else if field.symbol === "wireguard"}
            <Input bind:data={data.network.addAccess} {field} />
          {:else}
            <Input bind:data={data[field.symbol]} {field} />
          {/if}
        {/each}

        <SelectNodeId
          publicIp={data.publicIp}
          cpu={data.cpu}
          memory={data.memory}
          ssd={data.disks.reduce((total, disk) => total + disk.size, data.rootFs)}
          bind:nodeSelection={data.selection.type}
          bind:data={data.nodeId}
          filters={data.selection.filters}
          bind:status
          {profile}
          on:fetch={({ detail }) => (data.selection.nodes = detail)}
          nodes={data.selection.nodes}
        />
      </section>
      <section style={display(active, "env")}>
        <AddBtn on:click={() => (data.envs = [...data.envs, new Env()])} />
        <div class="nodes-container">
          {#each data.envs as env, index (env.id)}
            <div class="box">
              <DeleteBtn name={env.key} on:click={() => (data.envs = data.envs.filter((_, i) => index !== i))} />
              {#each envFields as field (field.symbol)}
                <Input bind:data={env[field.symbol]} {field} />
              {/each}
            </div>
          {/each}
        </div>
      </section>
      <section style={display(active, "disks")}>
        <AddBtn on:click={() => (data.disks = [...data.disks, new Disk()])} />
        <div class="nodes-container">
          {#each data.disks as disk, index (disk.id)}
            <div class="box">
              <DeleteBtn name={disk.name} on:click={() => (data.disks = data.disks.filter((_, i) => index !== i))} />
              {#each disk.diskFields as field (field.symbol)}
                {#if field.symbol === "mountpoint"}
                  <Input
                    bind:data={disk[field.symbol]}
                    field={{
                      ...field,
                      error: !field.invalid && !field.error ? validateMountPoint(disk) : null,
                    }}
                  />
                {:else if field.symbol === "name"}
                  <Input
                    bind:data={disk[field.symbol]}
                    field={{
                      ...field,
                      error: validateDiskName(disk),
                    }}
                  />
                {:else}
                  <Input bind:data={disk[field.symbol]} {field} bind:invalid={field.invalid} />
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      </section>

      <section style={display(active, "advanced")}>
        {#each networkFields as field (field.symbol)}
          <Input bind:data={data.network[field.symbol]} {field} />
        {/each}
      </section>
    </div>

    <DeployBtn
      disabled={disabled || validateFlist.loading}
      loading={loading || validateFlist.loading}
      {failed}
      {success}
      on:click={e => {
        if (success || failed) {
          e.preventDefault();
          success = false;
          failed = false;
          loading = false;
        }
      }}
    />
  </form>
</div>
{#if modalData}
  <Modal data={modalData} on:closed={() => (modalData = null)} />
{/if}

<style lang="scss" scoped>
  @import url("https://cdn.jsdelivr.net/npm/bulma@0.9.3/css/bulma.min.css");
  @import "../../assets/global.scss";
</style>
